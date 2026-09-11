"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";
import {
  buildCloud,
  makeScatter,
  makeDronePoints,
  makeSwarm,
  loadCloudImage,
  type Cloud,
} from "@/lib/cloud";
import { roleModes } from "@/content/profile";
import { SEQ } from "@/lib/sequence";

/**
 * Landing hero, as a single THREE.Points and one draw call.
 *
 * The opening runs in two acts on two position tracks:
 *
 *   act one   scattered particles gather into one survey drone, it holds
 *             station while the bar fills, then banks away out of frame. The
 *             landing's details are revealed behind it as it leaves.
 *   act two   the same particles re-enter as a formation of drones, fly in,
 *             and dissolve into the three-dimensional figure.
 *
 * The handoff between acts is a hard switch of `uTrack` made underneath an
 * alpha dip — by the time the track flips, nothing is on screen to see it
 * flip. Cross-fading the two tracks instead would drag every particle along a
 * straight line between a departing drone and an arriving one, which reads as
 * a smear rather than as two separate aircraft.
 *
 * Scatter, drone, swarm and figure are all position targets in the same
 * buffer, blended in the vertex shader, so the entire sequence costs exactly
 * one draw call from the first frame to the last and nothing is created or
 * destroyed part way through.
 */

const VERT = /* glsl */ `
  uniform float uAssemble;   // scatter -> single drone
  uniform vec3  uDepart;     // where the single drone has flown to
  uniform float uTrack;      // 0 = single drone, 1 = swarm
  uniform float uSwarmIn;    // swarm entry, off-screen -> formation
  uniform float uResolve;    // swarm -> figure
  uniform float uTime;
  uniform float uSize;
  uniform float uVis;
  uniform vec3  uRoleTint;
  uniform float uRoleAmt;
  uniform float uRoleMode;

  attribute vec3 aScatter;
  attribute vec3 aFigure;
  attribute vec3 aSwarm;
  attribute vec3 aSwarmHome;
  attribute vec3 aColor;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    // --- act one: one drone -------------------------------------------------
    vec3 droneTrack = mix(aScatter, position, uAssemble) + uDepart;

    // --- act two: the formation --------------------------------------------
    // Move whole airframes, not points: hold the point's offset within its own
    // drone fixed and interpolate only the drone's centre.
    vec3 local = aSwarm - aSwarmHome;
    vec3 entry = aSwarmHome * 3.2 + vec3(-6.0, 1.4, -1.2);
    vec3 swarmPos = mix(entry, aSwarmHome, uSwarmIn) + local;

    // outward burst on the way in, so the formation visibly comes apart
    float burst = sin(uResolve * 3.14159265) * 0.55;
    vec3 swarmTrack =
      mix(swarmPos, aFigure, uResolve) + normalize(aScatter) * burst;

    vec3 pos = mix(droneTrack, swarmTrack, uTrack);

    float idle = mix(0.035, 0.012, uResolve);
    pos.x += sin(uTime * 0.5 + aSeed * 9.0) * idle;
    pos.z += cos(uTime * 0.43 + aSeed * 7.0) * idle;

    // role expression, only once the figure has formed
    float rm = uRoleAmt * uResolve;
    if (rm > 0.001) {
      vec3 disp;
      if (uRoleMode < 0.5) {
        disp = vec3(
          sin(uTime * 7.0 + aSeed * 31.0),
          cos(uTime * 6.3 + aSeed * 17.0),
          sin(uTime * 5.1 + aSeed * 23.0)
        ) * 0.055;
      } else if (uRoleMode < 1.5) {
        float st = 0.14;
        disp = (floor(pos / st) * st + st * 0.5) - pos;
      } else if (uRoleMode < 2.5) {
        disp = vec3(0.0, 0.0, sin(pos.y * 8.0 - uTime * 2.6) * 0.12);
      } else {
        disp = -pos * 0.085;
      }
      pos += disp * rm;
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z) * (1.0 + rm * 0.25);

    // cyan hardware while it is a machine, true colour once it is a person
    vec3 cyan = vec3(0.15, 0.68, 0.80);
    vec3 base = mix(cyan, aColor, uResolve);

    // Depth shading. Without it a dense cloud is a flat sticker: every point
    // is the same brightness, so the silhouette reads but the volume does
    // not. Keying off the figure's own z darkens the back shell and lets the
    // chest, shoulders and arms separate from the body behind them.
    float front = smoothstep(-0.5, 0.62, aFigure.z);
    base *= mix(1.0, 0.40 + 0.72 * front, uResolve);

    vColor = mix(base, uRoleTint, rm * 0.72);

    float tw = 0.72 + 0.28 * sin(uTime * 1.3 + aSeed * 12.0);
    vFade = uVis * mix(tw, 0.95, uResolve) * (1.0 + rm * 0.35);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vColor, a * vFade * 0.72);
  }
`;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Where the single drone exits frame. */
const EXIT = new THREE.Vector3(3.4, 2.6, -1.4);

/** Drones in the formation. Enough to read as a swarm, few enough to read as craft. */
const SWARM_SIZE = 7;

function Points({ cloud }: { cloud: Cloud }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Points>(null);
  const t = useRef(0);
  const activeRole = useSystem((s) => s.activeRole);
  const introSkipped = useSystem((s) => s.introSkipped);

  const scatter = useMemo(
    () => makeScatter(cloud.count, cloud.height * 0.95),
    [cloud]
  );
  const drone = useMemo(
    () => makeDronePoints(cloud.count, cloud.height * 0.46),
    [cloud]
  );
  const swarm = useMemo(
    () =>
      makeSwarm(cloud.count, cloud.height * 0.1, SWARM_SIZE, cloud.height * 0.5),
    [cloud]
  );

  const uniforms = useMemo(
    () => ({
      uAssemble: { value: 0 },
      uDepart: { value: new THREE.Vector3() },
      uTrack: { value: 0 },
      uSwarmIn: { value: 0 },
      uResolve: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 2.4 },
      uVis: { value: 0 },
      uRoleTint: { value: new THREE.Color("#22d3ee") },
      uRoleAmt: { value: 0 },
      uRoleMode: { value: 0 },
    }),
    []
  );

  useFrame((state, d) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;

    // Skipping jumps the clock rather than special-casing every stage, so the
    // end state is reached by the same code path as playing it through.
    t.current = introSkipped
      ? Math.max(t.current, SEQ.resolveEnd)
      : t.current + d;
    const time = t.current;

    // --- act one ------------------------------------------------------------
    u.uAssemble.value = easeOutCubic(clamp01(time / SEQ.assembleEnd));

    const depart = clamp01(
      (time - SEQ.scanEnd) / (SEQ.departEnd - SEQ.scanEnd)
    );
    // accelerating away, rather than easing to a halt at the frame edge
    (u.uDepart.value as THREE.Vector3).copy(EXIT).multiplyScalar(
      easeInCubic(depart)
    );

    // --- act two ------------------------------------------------------------
    const swarmIn = easeOutCubic(
      clamp01((time - SEQ.departEnd) / (SEQ.swarmEnd - SEQ.departEnd))
    );
    u.uSwarmIn.value = swarmIn;
    u.uResolve.value = easeInOutCubic(
      clamp01((time - SEQ.swarmEnd) / (SEQ.resolveEnd - SEQ.swarmEnd))
    );

    // The switch happens while nothing is visible, so it cannot be seen.
    u.uTrack.value = time >= SEQ.departEnd ? 1 : 0;
    u.uVis.value =
      time < SEQ.departEnd
        ? easeOutCubic(clamp01(time / SEQ.assembleEnd)) *
          (1 - smoothstep(0.55, 1, depart))
        : smoothstep(0, 0.22, swarmIn);

    u.uTime.value = state.clock.elapsedTime;

    if (activeRole != null) {
      const r = roleModes[activeRole];
      u.uRoleMode.value = r.mode;
      (u.uRoleTint.value as THREE.Color).set(r.tint);
    }
    u.uRoleAmt.value = THREE.MathUtils.damp(
      u.uRoleAmt.value as number,
      activeRole == null ? 0 : 1,
      5,
      d
    );

    if (grp.current) {
      const resolve = u.uResolve.value as number;

      // the machines yaw under power, then the figure settles to face you
      const spin = grp.current.rotation.y + d * 0.5 * (1 - resolve);
      const sway = Math.sin(state.clock.elapsedTime * 0.3) * 0.22;
      grp.current.rotation.y = THREE.MathUtils.lerp(spin, sway, resolve * 0.25);

      // A quadcopter is a horizontal object, so a level camera sees it edge-on
      // as a flat smear. Tilt the view down onto the aircraft, then level off
      // as the figure — which is vertical — takes over.
      grp.current.rotation.x = THREE.MathUtils.lerp(-0.45, 0, resolve);
    }
  });

  return (
    <points ref={grp}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[drone, 3]} />
        <bufferAttribute attach="attributes-aFigure" args={[cloud.figure, 3]} />
        <bufferAttribute attach="attributes-aScatter" args={[scatter, 3]} />
        <bufferAttribute attach="attributes-aSwarm" args={[swarm.swarm, 3]} />
        <bufferAttribute
          attach="attributes-aSwarmHome"
          args={[swarm.home, 3]}
        />
        <bufferAttribute attach="attributes-aColor" args={[cloud.colors, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[cloud.seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function HeroCloud({ className }: { className?: string }) {
  const lowPower = useSystem((s) => s.lowPower);
  const [cloud, setCloud] = useState<Cloud | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCloudImage()
      .then((img) => {
        if (cancelled) return;
        setCloud(
          // Density is what makes the resolved figure read as a model rather
          // than a scattering of dots. It is one draw call either way, so the
          // cost is vertex shading and fill, which desktop absorbs easily.
          buildCloud(img, { height: 4.6, target: lowPower ? 12000 : 42000 })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lowPower]);

  if (!cloud) return null;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 7.8], fov: 42 }}
        dpr={lowPower ? 1 : [1, 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <Points cloud={cloud} />
      </Canvas>
    </div>
  );
}
