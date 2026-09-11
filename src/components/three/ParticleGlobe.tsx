"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";

/**
 * The living backdrop: particles scattered through space that assemble into a
 * globe, then keep breathing behind the whole system.
 *
 * Everything runs in a single THREE.Points with a custom shader — one draw
 * call, no per-particle objects. Position interpolation happens on the GPU;
 * the CPU only advances a couple of uniforms per frame.
 */

const VERT = /* glsl */ `
  uniform float uProgress;   // 0 = scattered, 1 = assembled
  uniform float uTime;
  uniform float uSize;

  attribute vec3 aScatter;   // where the particle starts
  attribute float aSeed;

  varying float vFade;

  void main() {
    // ease-out-expo so the assembly lands softly instead of snapping
    float p = uProgress >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * uProgress);

    vec3 pos = mix(aScatter, position, p);

    // gentle breathing once assembled, scaled by how assembled we are
    float breathe = sin(uTime * 0.6 + aSeed * 6.2831) * 0.035 * p;
    pos += normalize(position) * breathe;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Perspective-correct point size. uSize is calibrated as device pixels at
    // z = 6, so a particle stays a particle instead of a 100px blob that
    // additive-blends the whole sphere into a white disc.
    float tw = 0.75 + 0.25 * sin(uTime * 1.4 + aSeed * 12.0);
    gl_PointSize = uSize * tw * (6.0 / -mv.z);

    vFade = p * tw;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColorCore;
  uniform vec3 uColorEdge;
  varying float vFade;

  void main() {
    // round, soft-edged point
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.08, d);
    vec3 col = mix(uColorEdge, uColorCore, smoothstep(0.5, 0.0, d));

    // Kept well under 1 — thousands of additive sprites saturate fast, and a
    // dim field reads as depth where a bright one reads as a solid blob.
    gl_FragColor = vec4(col, alpha * vFade * 0.42);
  }
`;

function Globe({ count, radius }: { count: number; radius: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Points>(null);
  const start = useRef<number>(0);

  const { positions, scatter, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scatter = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    // Fibonacci sphere — even coverage, no polar clumping
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;

      positions[i * 3] = Math.cos(theta) * r * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * r * radius;

      // start far out, in a shell so nothing begins at the camera
      const sr = radius * (3.2 + Math.random() * 3.5);
      const st = Math.random() * Math.PI * 2;
      const sp = Math.acos(2 * Math.random() - 1);
      scatter[i * 3] = Math.sin(sp) * Math.cos(st) * sr;
      scatter[i * 3 + 1] = Math.cos(sp) * sr;
      scatter[i * 3 + 2] = Math.sin(sp) * Math.sin(st) * sr;

      seeds[i] = Math.random();
    }
    return { positions, scatter, seeds };
  }, [count, radius]);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 4.2 },
      uColorCore: { value: new THREE.Color("#67e8f9") },
      uColorEdge: { value: new THREE.Color("#0e7490") },
    }),
    []
  );

  useFrame((state, delta) => {
    if (!matRef.current) return;
    start.current += delta;

    // ~2.6s to assemble, then hold
    const p = Math.min(1, start.current / 2.6);
    matRef.current.uniforms.uProgress.value = p;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.055;
      // settle the tilt as it assembles
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -0.18,
        delta * 1.2
      );
    }
  });

  return (
    <points ref={groupRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute attach="attributes-aScatter" args={[scatter, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
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

export default function ParticleGlobe({
  className,
}: {
  className?: string;
}) {
  const lowPower = useSystem((s) => s.lowPower);
  const count = lowPower ? 2200 : 6000;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 9.4], fov: 45 }}
        dpr={lowPower ? 1 : [1, 1.8]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        // Never let the canvas trap scroll or clicks meant for the UI above it
        style={{ pointerEvents: "none" }}
      >
        <Globe count={count} radius={2.3} />
      </Canvas>
    </div>
  );
}
