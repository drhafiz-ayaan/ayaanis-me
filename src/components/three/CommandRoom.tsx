"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";

/**
 * The command room: a holographic volume the hub UI floats inside.
 *
 * Deliberately cheap — a shader floor, one instanced mesh of shards, and two
 * wireframe cores. No post-processing: bloom would double the frame cost for
 * an effect the additive shards already imply.
 */

/* ---------------- shader floor ---------------- */

const FLOOR_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;

  // Anti-aliased grid line using screen-space derivatives, so distant lines
  // thin out instead of aliasing into noise.
  float grid(vec2 p, float scale) {
    vec2 c = p * scale;
    vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }

  void main() {
    float fine  = grid(vUv, 90.0) * 0.30;
    float major = grid(vUv, 18.0) * 0.65;

    // radial falloff so the floor dissolves rather than ending on an edge
    float d = length(vUv - 0.5) * 2.0;
    float fade = smoothstep(1.0, 0.15, d);

    // a slow pulse travelling outward, like a radar sweep settling
    float pulse = 0.5 + 0.5 * sin(d * 9.0 - uTime * 1.1);
    float lines = (fine + major) * (0.75 + 0.25 * pulse);

    float a = lines * fade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Floor() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#22d3ee") },
    }),
    []
  );
  useFrame((s) => {
    if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.1, 0]}>
      <planeGeometry args={[46, 46]} />
      <shaderMaterial
        ref={mat}
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

/* ---------------- floating shards ---------------- */

function Shards({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        // Kept well behind the camera plane. Shards drifting close to the lens
        // read as clutter over the UI rather than depth behind it.
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 14 - 8
        ),
        rot: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        scale: 0.05 + Math.random() * 0.1,
        spin: (Math.random() - 0.5) * 0.4,
        drift: 0.12 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      })),
    [count]
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    seeds.forEach((sd, i) => {
      dummy.position.set(
        sd.pos.x,
        sd.pos.y + Math.sin(t * sd.drift + sd.phase) * 0.5,
        sd.pos.z
      );
      dummy.rotation.set(
        sd.rot.x + t * sd.spin * 0.3,
        sd.rot.y + t * sd.spin,
        sd.rot.z
      );
      dummy.scale.setScalar(sd.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color="#7dd3fc"
        transparent
        opacity={0.3}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        wireframe
      />
    </instancedMesh>
  );
}

/* ---------------- central cores ---------------- */

function Core() {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame((s, d) => {
    const t = s.clock.elapsedTime;
    if (outer.current) {
      outer.current.rotation.y += d * 0.12;
      outer.current.rotation.x = Math.sin(t * 0.22) * 0.16;
    }
    if (inner.current) {
      inner.current.rotation.y -= d * 0.3;
      inner.current.rotation.z += d * 0.1;
      const k = 1 + Math.sin(t * 0.9) * 0.05;
      inner.current.scale.setScalar(k);
    }
  });

  return (
    <group position={[0, 0.2, -5]}>
      <mesh ref={outer}>
        <icosahedronGeometry args={[3.1, 1]} />
        <meshBasicMaterial
          color="#0e7490"
          wireframe
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshBasicMaterial
          color="#22d3ee"
          wireframe
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ---------------- camera drift + parallax ---------------- */

function Rig({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useFrame((s, d) => {
    const t = s.clock.elapsedTime;
    // pointer is normalised -1..1 by R3F
    const px = enabled ? s.pointer.x : 0;
    const py = enabled ? s.pointer.y : 0;

    target.current.x = px * 1.1 + Math.sin(t * 0.16) * 0.35;
    target.current.y = py * 0.55 + Math.cos(t * 0.13) * 0.22;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      target.current.x,
      2.2,
      d
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      target.current.y,
      2.2,
      d
    );
    camera.lookAt(0, 0, -5);
  });

  return null;
}

export default function CommandRoom({ className }: { className?: string }) {
  const lowPower = useSystem((s) => s.lowPower);

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={lowPower ? 1 : [1, 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <Floor />
        <Core />
        <Shards count={lowPower ? 24 : 60} />
        <Rig enabled={!lowPower} />
      </Canvas>
    </div>
  );
}
