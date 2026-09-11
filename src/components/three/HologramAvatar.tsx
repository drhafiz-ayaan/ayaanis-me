"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";
import { buildCloud, makeScatter, loadCloudImage, type Cloud } from "@/lib/cloud";

/**
 * The standing hologram in the Mission Briefing module: the same point cloud
 * as the hero, assembled in place with a scan line sweeping up the body.
 */

const VERT = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;

  attribute vec3 aScatter;
  attribute vec3 aColor;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    float p = uProgress >= 1.0 ? 1.0 : 1.0 - pow(2.0, -9.0 * uProgress);
    vec3 pos = mix(aScatter, position, p);

    pos.x += sin(uTime * 0.5 + aSeed * 9.0) * 0.012;
    pos.z += cos(uTime * 0.42 + aSeed * 7.0) * 0.018;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z);

    float scan = smoothstep(0.18, 0.0, abs(fract(uTime * 0.13) * 5.4 - 2.7 - pos.y));

    vColor = aColor + vec3(0.05, 0.34, 0.44) * scan;
    vFade = p * (0.62 + 0.2 * sin(uTime * 1.1 + aSeed * 6.0) + scan * 0.45);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(vColor, a * vFade * 0.8);
  }
`;

function Figure({ cloud }: { cloud: Cloud }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Points>(null);
  const t = useRef(0);

  const scatter = useMemo(
    () => makeScatter(cloud.count, cloud.height * 0.8),
    [cloud]
  );

  const uniforms = useMemo(
    () => ({ uProgress: { value: 0 }, uTime: { value: 0 }, uSize: { value: 3.3 } }),
    []
  );

  useFrame((state, d) => {
    t.current += d;
    if (mat.current) {
      mat.current.uniforms.uProgress.value = Math.min(1, t.current / 2.2);
      mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (grp.current) {
      // a slow turn that never reaches the thin side-on profile
      grp.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.38;
    }
  });

  return (
    <points ref={grp}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[cloud.figure, 3]} />
        <bufferAttribute attach="attributes-aScatter" args={[scatter, 3]} />
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

export default function HologramAvatar({ className }: { className?: string }) {
  const lowPower = useSystem((s) => s.lowPower);
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCloudImage()
      .then((img) => {
        if (cancelled) return;
        setCloud(buildCloud(img, { height: 5.0, target: lowPower ? 7000 : 15000 }));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [lowPower]);

  if (failed) return null;

  return (
    <div className={className}>
      {!cloud && (
        <div className="flex h-full items-center justify-center">
          <span className="label-hud animate-pulse">Reconstructing…</span>
        </div>
      )}
      {cloud && (
        <Canvas
          camera={{ position: [0, 0, 6.6], fov: 46 }}
          dpr={lowPower ? 1 : [1, 1.75]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          style={{ pointerEvents: "none" }}
        >
          <Figure cloud={cloud} />
        </Canvas>
      )}
    </div>
  );
}
