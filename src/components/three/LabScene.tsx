"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";

/**
 * Robotics Lab viewport — two stylised scenes sharing one canvas.
 *
 *   swarm : ground robots holding formation with no central coordinator,
 *           the link lines redrawn every frame from actual positions.
 *   uav   : a quadcopter flying an orbit, its LiDAR progressively revealing
 *           the ground map underneath it.
 *
 * Same rules as the command room: basic materials, additive blending, no
 * lights and no post-processing. This mounts inside a modal, so it has to be
 * cheap enough to appear instantly and disappear again.
 */

export type LabMode = "swarm" | "uav";

const CYAN = "#22d3ee";
const ICE = "#7dd3fc";

/* ---------------- shared ground ---------------- */

const FLOOR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  float grid(vec2 p, float s) {
    vec2 c = p * s;
    vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    float fine = grid(vUv, 48.0) * 0.28;
    float major = grid(vUv, 12.0) * 0.6;
    float fade = smoothstep(0.95, 0.15, length(vUv - 0.5) * 2.0);
    float a = (fine + major) * fade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Ground() {
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(CYAN) } }),
    []
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
      <planeGeometry args={[26, 26]} />
      <shaderMaterial
        vertexShader={FLOOR_VERT}
        fragmentShader={FLOOR_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ---------------- swarm ---------------- */

const SWARM_N = 5;

/** One TurtleBot-ish unit: chassis, heading marker, and a scan ring. */
function Bot({ tint }: { tint: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.44, 0.17, 0.54]} />
        <meshBasicMaterial color={tint} wireframe transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.1, 10]} />
        <meshBasicMaterial color={tint} wireframe transparent opacity={0.55} />
      </mesh>
      {/* heading marker */}
      <mesh position={[0, 0.02, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.18, 6]} />
        <meshBasicMaterial color={ICE} transparent opacity={0.9} />
      </mesh>
      {/* footprint */}
      <mesh position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.4, 20]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Swarm() {
  const bots = useRef<(THREE.Group | null)[]>([]);
  const linkRef = useRef<THREE.BufferGeometry>(null);

  // V formation offsets, in formation-local space
  const slots = useMemo(
    () =>
      Array.from({ length: SWARM_N }, (_, i) => {
        const k = i - (SWARM_N - 1) / 2;
        return new THREE.Vector3(k * 0.95, 0, -Math.abs(k) * 0.8);
      }),
    []
  );

  // one segment between each consecutive pair, rebuilt every frame
  const linkPos = useMemo(
    () => new Float32Array((SWARM_N - 1) * 2 * 3),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // the whole formation orbits, and each unit holds its slot with a little
    // independent correction — the point being that nothing is commanding it
    const cx = Math.cos(t * 0.32) * 1.8;
    const cz = Math.sin(t * 0.32) * 1.8;
    const heading = t * 0.32 + Math.PI / 2;

    for (let i = 0; i < SWARM_N; i++) {
      const g = bots.current[i];
      if (!g) continue;
      const s = slots[i];
      const sx = s.x * Math.cos(heading) - s.z * Math.sin(heading);
      const sz = s.x * Math.sin(heading) + s.z * Math.cos(heading);

      const jitter = Math.sin(t * 1.3 + i * 2.1) * 0.07;
      g.position.set(cx + sx + jitter, -0.38, cz + sz + jitter * 0.6);
      g.rotation.y = heading + Math.sin(t * 0.9 + i) * 0.06;

      if (i > 0) {
        const p = bots.current[i - 1];
        if (p) {
          const o = (i - 1) * 6;
          linkPos[o] = p.position.x;
          linkPos[o + 1] = p.position.y;
          linkPos[o + 2] = p.position.z;
          linkPos[o + 3] = g.position.x;
          linkPos[o + 4] = g.position.y;
          linkPos[o + 5] = g.position.z;
        }
      }
    }
    if (linkRef.current) {
      linkRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {Array.from({ length: SWARM_N }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            bots.current[i] = el;
          }}
        >
          <Bot tint={i === Math.floor(SWARM_N / 2) ? ICE : CYAN} />
        </group>
      ))}

      {/* peer-to-peer links */}
      <lineSegments>
        <bufferGeometry ref={linkRef}>
          <bufferAttribute attach="attributes-position" args={[linkPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={CYAN}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

/* ---------------- UAV ---------------- */

const MAP_POINTS = 900;

function Drone() {
  const body = useRef<THREE.Group>(null);
  const rotors = useRef<(THREE.Mesh | null)[]>([]);
  const beam = useRef<THREE.Mesh>(null);
  const mapRef = useRef<THREE.BufferGeometry>(null);

  const arms: [number, number][] = [
    [0.34, 0.34],
    [-0.34, 0.34],
    [0.34, -0.34],
    [-0.34, -0.34],
  ];

  // ground map the LiDAR "discovers" — points are placed up front and
  // revealed by alpha as the drone passes over them
  const { mapPos, mapAlpha, mapAngle } = useMemo(() => {
    const pos = new Float32Array(MAP_POINTS * 3);
    const alpha = new Float32Array(MAP_POINTS);
    const angle = new Float32Array(MAP_POINTS);
    for (let i = 0; i < MAP_POINTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 3.4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos[i * 3] = x;
      pos[i * 3 + 1] = -0.88 + Math.random() * 0.06;
      pos[i * 3 + 2] = z;
      alpha[i] = 0;
      angle[i] = Math.atan2(z, x);
    }
    return { mapPos: pos, mapAlpha: alpha, mapAngle: angle };
  }, []);

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    const orbit = t * 0.45;
    const r = 2.0;
    const x = Math.cos(orbit) * r;
    const z = Math.sin(orbit) * r;
    const y = 0.95 + Math.sin(t * 0.8) * 0.18;

    if (body.current) {
      body.current.position.set(x, y, z);
      body.current.rotation.y = -orbit + Math.PI / 2;
      // bank into the turn, and pitch slightly with climb
      body.current.rotation.z = 0.22;
      body.current.rotation.x = Math.cos(t * 0.8) * 0.07;
    }

    rotors.current.forEach((m, i) => {
      if (m) m.rotation.y += d * (34 + i * 2);
    });

    if (beam.current) {
      // midpoint between the aircraft and the ground plane at y = -0.9
      beam.current.position.set(x, (y - 0.9) / 2, z);
      beam.current.scale.y = Math.max(0.05, y + 0.9);
    }

    // reveal map points near the drone's current bearing
    const bearing = Math.atan2(z, x);
    let dirty = false;
    for (let i = 0; i < MAP_POINTS; i++) {
      if (mapAlpha[i] >= 1) continue;
      let diff = Math.abs(mapAngle[i] - bearing);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.5) {
        mapAlpha[i] = Math.min(1, mapAlpha[i] + d * 2.2);
        dirty = true;
      }
    }
    if (dirty && mapRef.current) {
      mapRef.current.attributes.aAlpha.needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={body}>
        <mesh>
          <boxGeometry args={[0.34, 0.12, 0.5]} />
          <meshBasicMaterial color={ICE} wireframe transparent opacity={0.9} />
        </mesh>
        {arms.map(([ax, az], i) => (
          <group key={i} position={[ax, 0.02, az]}>
            <mesh
              position={[-ax / 2, 0, -az / 2]}
              rotation={[0, Math.atan2(az, ax), 0]}
            >
              <boxGeometry args={[0.5, 0.03, 0.03]} />
              <meshBasicMaterial color={CYAN} transparent opacity={0.7} />
            </mesh>
            <mesh
              ref={(el) => {
                rotors.current[i] = el;
              }}
              position={[0, 0.06, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.13, 0.2, 14]} />
              <meshBasicMaterial
                color={CYAN}
                transparent
                opacity={0.45}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* LiDAR cone down to the ground */}
      <mesh ref={beam} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.55, 1, 16, 1, true]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* the twin being built underneath */}
      <points>
        <bufferGeometry ref={mapRef}>
          <bufferAttribute attach="attributes-position" args={[mapPos, 3]} />
          <bufferAttribute attach="attributes-aAlpha" args={[mapAlpha, 1]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            attribute float aAlpha;
            varying float vA;
            void main() {
              vA = aAlpha;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mv;
              gl_PointSize = 3.2 * (6.0 / -mv.z);
            }
          `}
          fragmentShader={`
            varying float vA;
            void main() {
              vec2 uv = gl_PointCoord - 0.5;
              if (length(uv) > 0.5) discard;
              gl_FragColor = vec4(0.45, 0.85, 1.0, vA * 0.8);
            }
          `}
        />
      </points>
    </group>
  );
}

/* ---------------- camera ---------------- */

function Rig() {
  const { current: target } = useRef(new THREE.Vector3(0, -0.1, 0));
  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.damp(
      cam.position.x,
      state.pointer.x * 1.6 + Math.sin(t * 0.12) * 0.5,
      2,
      d
    );
    cam.position.y = THREE.MathUtils.damp(
      cam.position.y,
      1.8 + state.pointer.y * 0.5,
      2,
      d
    );
    cam.lookAt(target);
  });
  return null;
}

export default function LabScene({
  mode,
  className,
}: {
  mode: LabMode;
  className?: string;
}) {
  const lowPower = useSystem((s) => s.lowPower);

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 2.0, 6.6], fov: 42 }}
        dpr={lowPower ? 1 : [1, 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <Ground />
        {mode === "swarm" ? <Swarm /> : <Drone />}
        <Rig />
      </Canvas>
    </div>
  );
}
