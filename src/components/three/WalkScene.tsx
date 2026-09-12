"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";
import { loadCloudImage, buildCloud, type Cloud } from "@/lib/cloud";
import { buildWalker, poseWalk, BONES, type Walker } from "@/lib/walker";
import { roleModes } from "@/content/profile";

/**
 * The walking figure, its reflection, the floor it walks on, and the
 * hologram standing behind it.
 *
 * Three systems share one canvas:
 *
 *   figure    a point cloud skinned to a procedural humanoid, shaded so it
 *             reads as a body with volume rather than a cloud of dots. Drawn
 *             twice — once upright, once mirrored under the floor.
 *   sparks    particles that fall, bounce and settle, kicked up by the
 *             figure's actual footfalls rather than on a timer.
 *   hologram  the portrait cloud, standing behind at reduced intensity. This
 *             is the one that carries the likeness; the walker carries motion.
 */

const KEY_LIGHT = new THREE.Vector3(-0.45, 0.62, 0.75).normalize();

/* ------------------------------------------------------------------ figure */

const FIG_VERT = /* glsl */ `
  uniform vec3  uA[${BONES}];
  uniform vec3  uB[${BONES}];
  uniform vec3  uR[${BONES}];
  uniform vec3  uF[${BONES}];
  uniform float uMirror;
  uniform float uSize;
  uniform float uTime;
  uniform float uFade;
  uniform vec3  uLight;
  uniform vec3  uTint;
  uniform float uTintAmt;
  uniform float uBurst;

  attribute float aBone;
  attribute float aT;
  attribute vec3  aOffset;
  attribute vec3  aColor;
  attribute float aSeed;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    int b = int(aBone + 0.5);
    vec3 radial = uR[b] * aOffset.x + uF[b] * aOffset.z;
    vec3 pos = mix(uA[b], uB[b], aT) + radial;

    // The role burst blows the body apart along its own surface normals and
    // lets it draw back together, so the figure comes apart rather than
    // simply scattering into unrelated noise.
    vec3 n = normalize(radial + vec3(0.0, 0.0008, 0.0));
    pos += n * uBurst * (0.55 + aSeed * 0.9);

    // reflection: mirror through the floor plane, and flip the normal with it
    float m = uMirror;
    pos.y = mix(pos.y, -pos.y, m);
    n.y = mix(n.y, -n.y, m);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z);

    // Shading is what stops this reading as a particle effect. A flat cloud
    // has every point at one brightness, so only the outline survives; a
    // lambert term plus a rim makes the chest, shoulders and legs turn away
    // from the light and the body gains a front and a side.
    float diff = 0.34 + 0.66 * max(0.0, dot(n, uLight));
    float rim = pow(1.0 - max(0.0, dot(n, vec3(0.0, 0.0, 1.0))), 2.2);

    vec3 c = aColor * diff + vec3(0.16, 0.74, 0.92) * rim * 0.40;
    c = mix(c, uTint, uTintAmt * 0.8);

    // the reflection is dimmer and dies off with distance under the floor
    float refFade = mix(1.0, 0.52 * exp(pos.y * 0.55), m);

    vColor = c;
    vAlpha = uFade * refFade * (0.78 + 0.22 * sin(uTime * 1.4 + aSeed * 11.0));
  }
`;

const FIG_FRAG = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.06, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

function figureUniforms(mirror: number) {
  return {
    uA: { value: Array.from({ length: BONES }, () => new THREE.Vector3()) },
    uB: { value: Array.from({ length: BONES }, () => new THREE.Vector3()) },
    uR: { value: Array.from({ length: BONES }, () => new THREE.Vector3()) },
    uF: { value: Array.from({ length: BONES }, () => new THREE.Vector3()) },
    uMirror: { value: mirror },
    uSize: { value: 2.5 },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uLight: { value: KEY_LIGHT.clone() },
    uTint: { value: new THREE.Color("#22d3ee") },
    uTintAmt: { value: 0 },
    uBurst: { value: 0 },
  };
}

/* ------------------------------------------------------------------- floor */

const FLOOR_VERT = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vXZ = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOOR_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3  uTint;
  uniform float uTintAmt;
  varying vec2 vXZ;

  void main() {
    // Screen-space derivatives keep the grid one pixel wide at every distance.
    // A fixed line width aliases into noise as the floor recedes.
    vec2 g = abs(fract(vXZ * 0.5) - 0.5) / fwidth(vXZ * 0.5);
    float line = 1.0 - min(min(g.x, g.y), 1.0);

    float r = length(vXZ);
    float fade = smoothstep(16.0, 2.0, r);

    // a slow ring travelling outward, so the floor is not inert
    float pulse = smoothstep(0.55, 0.0, abs(fract(r * 0.12 - uTime * 0.05) - 0.5) * 2.0);

    vec3 base = mix(vec3(0.13, 0.62, 0.78), uTint, uTintAmt * 0.75);
    float a = (line * 0.42 + pulse * 0.10) * fade;
    gl_FragColor = vec4(base, a);
  }
`;

/* ------------------------------------------------------------------ sparks */

const SPARK_COUNT = 700;
const GRAVITY = -7.4;
const RESTITUTION = 0.46;

const SPARK_VERT = /* glsl */ `
  uniform float uSize;
  uniform vec3  uTint;
  uniform float uTintAmt;
  attribute float aLife;
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z) * (0.5 + aLife * 0.7);
    vColor = mix(vec3(0.35, 0.85, 1.0), uTint, uTintAmt);
    vAlpha = clamp(aLife, 0.0, 1.0);
  }
`;

const SPARK_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vAlpha * 0.85);
  }
`;

/**
 * Bouncing floor particles.
 *
 * Simulated on the CPU rather than solved in the shader: a closed form for a
 * damped bounce has to branch on which bounce it is currently in, and the
 * whole point of these is that footfalls inject new ones at arbitrary times,
 * which a stateless formula cannot represent. Seven hundred particles of
 * Euler integration is not a measurable cost next to the draw.
 */
function useSparks(count: number) {
  return useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // start the pool scattered and already falling, so the floor is alive
      // from the first frame instead of filling up over the first few seconds
      pos[i * 3] = (Math.random() - 0.5) * 5.5;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.4;
      vel[i * 3 + 1] = -Math.random() * 0.6;
      life[i] = Math.random() * 0.55;
    }
    return { pos, vel, life, cursor: { i: 0 } };
  }, [count]);
}

/* -------------------------------------------------------------------- rig */

function Scene({
  walker,
  cloud,
  lowPower,
}: {
  walker: Walker;
  cloud: Cloud | null;
  lowPower: boolean;
}) {
  const activeRole = useSystem((s) => s.activeRole);

  const matA = useRef<THREE.ShaderMaterial>(null);
  const matB = useRef<THREE.ShaderMaterial>(null);
  const floorMat = useRef<THREE.ShaderMaterial>(null);
  const sparkMat = useRef<THREE.ShaderMaterial>(null);
  const sparkGeo = useRef<THREE.BufferGeometry>(null);
  const holoRef = useRef<THREE.Points>(null);

  const uniA = useMemo(() => figureUniforms(0), []);
  const uniB = useMemo(() => figureUniforms(1), []);

  // scratch buffers for the pose, reused every frame
  const pose = useMemo(
    () => ({
      A: new Float32Array(BONES * 3),
      B: new Float32Array(BONES * 3),
      R: new Float32Array(BONES * 3),
      F: new Float32Array(BONES * 3),
      prev: { lY: 1, rY: 1 },
    }),
    []
  );

  const sparks = useSparks(lowPower ? 260 : SPARK_COUNT);
  const tint = useMemo(() => new THREE.Color(), []);
  const burst = useRef(0);
  const prevRole = useRef<number | null>(null);
  const tintAmt = useRef(0);

  const { gl, scene, camera } = useThree();

  /**
   * The frame's work, kept as a plain function of (time, dt) rather than
   * living inside useFrame.
   *
   * Everything here is a pure function of elapsed time, so exposing it lets a
   * frame be rendered at an exact point in the walk cycle instead of whenever
   * the animation loop happens to tick. That is the only way to inspect a
   * specific pose, and it keeps working when requestAnimationFrame is
   * throttled — a backgrounded tab, or a preview pane that is not on screen.
   */
  const step = useRef<(time: number, dRaw: number) => void>(() => {});

  step.current = (time: number, dRaw: number) => {
    const d = Math.min(dRaw, 1 / 30);

    // --- role response ------------------------------------------------------
    const want = activeRole == null ? 0 : 1;
    tintAmt.current = THREE.MathUtils.damp(tintAmt.current, want, 4.5, d);
    if (activeRole != null) tint.set(roleModes[activeRole].tint);
    // the burst spikes on entry then relaxes, so hovering detonates once
    // barely any inflation: enough to read as energised, not enough to lose
    // the silhouette. The explosion behind carries the drama instead.
    burst.current = THREE.MathUtils.damp(burst.current, want * 0.022, 3, d);

    // --- walk ---------------------------------------------------------------
    const res = poseWalk(
      time,
      walker.rig,
      0.62,
      pose.A,
      pose.B,
      pose.R,
      pose.F,
      pose.prev
    );

    for (const m of [matA.current, matB.current]) {
      if (!m) continue;
      const u = m.uniforms;
      for (let b = 0; b < BONES; b++) {
        (u.uA.value[b] as THREE.Vector3).fromArray(pose.A, b * 3);
        (u.uB.value[b] as THREE.Vector3).fromArray(pose.B, b * 3);
        (u.uR.value[b] as THREE.Vector3).fromArray(pose.R, b * 3);
        (u.uF.value[b] as THREE.Vector3).fromArray(pose.F, b * 3);
      }
      u.uTime.value = time;
      u.uBurst.value = burst.current;
      u.uTintAmt.value = tintAmt.current;
      (u.uTint.value as THREE.Color).copy(tint);
    }

    if (floorMat.current) {
      floorMat.current.uniforms.uTime.value = time;
      floorMat.current.uniforms.uTintAmt.value = tintAmt.current;
      (floorMat.current.uniforms.uTint.value as THREE.Color).copy(tint);
    }
    if (sparkMat.current) {
      sparkMat.current.uniforms.uTintAmt.value = tintAmt.current;
      (sparkMat.current.uniforms.uTint.value as THREE.Color).copy(tint);
    }

    // --- sparks -------------------------------------------------------------
    const { pos, vel, life, cursor } = sparks;
    const n = life.length;

    /** Kicks particles up off the floor — a footfall throwing up dust. */
    const scuff = (x: number, z: number, amount: number, power: number) => {
      for (let k = 0; k < amount; k++) {
        const i = cursor.i++ % n;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.16;
        pos[i * 3] = x + Math.cos(a) * r;
        pos[i * 3 + 1] = 0.02;
        pos[i * 3 + 2] = z + Math.sin(a) * r;
        vel[i * 3] = Math.cos(a) * (0.5 + Math.random()) * power;
        vel[i * 3 + 1] = (1.1 + Math.random() * 1.5) * power;
        vel[i * 3 + 2] = Math.sin(a) * (0.5 + Math.random()) * power;
        life[i] = 1;
      }
    };

    /** Detonates a sphere of particles in mid-air, behind the figure. */
    const burstAt = (
      x: number,
      y: number,
      z: number,
      amount: number,
      power: number
    ) => {
      for (let k = 0; k < amount; k++) {
        const i = cursor.i++ % n;
        // even directions on a sphere, so it opens as a shell not a fan
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const sx = Math.sin(ph) * Math.cos(th);
        const sy = Math.cos(ph);
        const sz = Math.sin(ph) * Math.sin(th);
        const sp = power * (0.45 + Math.random() * 0.75);
        pos[i * 3] = x + sx * 0.12;
        pos[i * 3 + 1] = y + sy * 0.12;
        pos[i * 3 + 2] = z + sz * 0.12;
        vel[i * 3] = sx * sp;
        vel[i * 3 + 1] = sy * sp + 0.5;
        vel[i * 3 + 2] = sz * sp;
        life[i] = 1;
      }
    };

    // A role detonates once on entry and then smoulders while it is held. The
    // explosion is thrown behind the figure rather than through it: blowing the
    // body apart destroys the very thing the hover is meant to draw attention
    // to, and a walk cycle is unreadable once its limbs have scattered.
    if (activeRole != null && prevRole.current !== activeRole) {
      burstAt(-0.35, walker.rig.height * 0.52, -1.35, 190, 3.4);
    }
    prevRole.current = activeRole;

    if (res.contactL) scuff(res.footLX, res.footLZ, 38, 1);
    if (res.contactR) scuff(res.footRX, res.footRZ, 38, 1);
    // while the role is held, the burst keeps breathing rather than dying out
    if (activeRole != null && Math.random() < 0.7) {
      burstAt(
        -0.35 + (Math.random() - 0.5) * 1.5,
        walker.rig.height * (0.3 + Math.random() * 0.5),
        -1.35 + (Math.random() - 0.5) * 0.9,
        4,
        1.9
      );
    }

    for (let i = 0; i < n; i++) {
      if (life[i] <= 0) continue;
      vel[i * 3 + 1] += GRAVITY * d;
      pos[i * 3] += vel[i * 3] * d;
      pos[i * 3 + 1] += vel[i * 3 + 1] * d;
      pos[i * 3 + 2] += vel[i * 3 + 2] * d;

      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = -pos[i * 3 + 1] * RESTITUTION;
        vel[i * 3 + 1] = -vel[i * 3 + 1] * RESTITUTION;
        // friction on contact, so they skitter to a stop instead of sliding
        vel[i * 3] *= 0.72;
        vel[i * 3 + 2] *= 0.72;
        if (Math.abs(vel[i * 3 + 1]) < 0.25) {
          vel[i * 3 + 1] = 0;
          pos[i * 3 + 1] = 0;
        }
      }
      life[i] -= d * 0.22;
    }

    if (sparkGeo.current) {
      sparkGeo.current.attributes.position.needsUpdate = true;
      sparkGeo.current.attributes.aLife.needsUpdate = true;
    }

    // the hologram behind breathes and turns very slowly
    if (holoRef.current) {
      holoRef.current.rotation.y = Math.sin(time * 0.16) * 0.22;
    }
  };

  useFrame((state, dRaw) => step.current(state.clock.elapsedTime, dRaw));

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as Record<string, unknown>).__pump = (t: number) => {
      step.current(t, 1 / 60);
      gl.render(scene, camera);
      return { rig: walker.rig, count: walker.count };
    };
  }, [gl, scene, camera, walker]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("aBone", new THREE.BufferAttribute(walker.bone, 1));
    g.setAttribute("aT", new THREE.BufferAttribute(walker.t, 1));
    g.setAttribute("aOffset", new THREE.BufferAttribute(walker.offset, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(walker.colors, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(walker.seeds, 1));
    // position is unused by the shader but three requires it to size the draw
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(walker.count * 3), 3)
    );
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.4, 0), 6);
    return g;
  }, [walker]);

  return (
    <group rotation={[0, -0.9, 0]}>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <shaderMaterial
          ref={floorMat}
          vertexShader={FLOOR_VERT}
          fragmentShader={FLOOR_FRAG}
          uniforms={{
            uTime: { value: 0 },
            uTint: { value: new THREE.Color("#22d3ee") },
            uTintAmt: { value: 0 },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* the hologram standing behind, carrying the likeness */}
      {cloud && (
        <points ref={holoRef} position={[-2.4, 1.95, -2.0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[cloud.figure, 3]}
            />
            <bufferAttribute attach="attributes-aColor" args={[cloud.colors, 3]} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={/* glsl */ `
              attribute vec3 aColor;
              varying vec3 vColor;
              void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = 1.9 * (6.0 / -mv.z);
                vColor = aColor;
              }
            `}
            fragmentShader={/* glsl */ `
              varying vec3 vColor;
              void main() {
                vec2 uv = gl_PointCoord - 0.5;
                if (length(uv) > 0.5) discard;
                gl_FragColor = vec4(vColor, 0.34);
              }
            `}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* reflection first, so the upright figure blends over it */}
      <points geometry={geo}>
        <shaderMaterial
          ref={matB}
          vertexShader={FIG_VERT}
          fragmentShader={FIG_FRAG}
          uniforms={uniB}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points geometry={geo}>
        <shaderMaterial
          ref={matA}
          vertexShader={FIG_VERT}
          fragmentShader={FIG_FRAG}
          uniforms={uniA}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* sparks */}
      <points>
        <bufferGeometry ref={sparkGeo}>
          <bufferAttribute attach="attributes-position" args={[sparks.pos, 3]} />
          <bufferAttribute attach="attributes-aLife" args={[sparks.life, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={sparkMat}
          vertexShader={SPARK_VERT}
          fragmentShader={SPARK_FRAG}
          uniforms={{
            uSize: { value: 2.8 },
            uTint: { value: new THREE.Color("#22d3ee") },
            uTintAmt: { value: 0 },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function WalkScene({ className }: { className?: string }) {
  const lowPower = useSystem((s) => s.lowPower);
  const [walker, setWalker] = useState<Walker | null>(null);
  const [cloud, setCloud] = useState<Cloud | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCloudImage()
      .then((img) => {
        if (cancelled) return;
        setWalker(
          buildWalker(img, { count: lowPower ? 7000 : 22000, height: 3.0 })
        );
        setCloud(
          buildCloud(img, { height: 3.6, target: lowPower ? 4000 : 11000 })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lowPower]);

  if (!walker) return null;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0.2, 1.75, 6.4], fov: 40 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.35, 0)}
        dpr={lowPower ? 1 : [1, 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <Scene walker={walker} cloud={cloud} lowPower={lowPower} />
      </Canvas>
    </div>
  );
}
