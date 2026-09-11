"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";
import { buildCloud, makeScatter, loadCloudImage, type Cloud } from "@/lib/cloud";

/**
 * Landing hero: particles fly in, gather into a globe, then the globe resolves
 * into Ayaan. One THREE.Points, one draw call — the three shapes are three
 * position attributes and the blend happens in the vertex shader.
 */

const VERT = /* glsl */ `
  uniform float uAssemble;  // scatter -> sphere
  uniform float uMorph;     // sphere  -> figure
  uniform float uTime;
  uniform float uSize;

  attribute vec3 aScatter;
  attribute vec3 aFigure;
  attribute vec3 aColor;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec3 sphere = mix(aScatter, position, uAssemble);
    vec3 pos = mix(sphere, aFigure, uMorph);

    // drift keeps it alive; it fades out as the figure resolves so the
    // likeness stays crisp rather than shimmering
    float idle = mix(0.05, 0.014, uMorph);
    pos.x += sin(uTime * 0.5 + aSeed * 9.0) * idle;
    pos.z += cos(uTime * 0.43 + aSeed * 7.0) * idle;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z);

    // cyan while it is still a globe, true colour once it is a person
    vec3 cyan = vec3(0.15, 0.68, 0.80);
    vColor = mix(cyan, aColor, uMorph);

    float tw = 0.72 + 0.28 * sin(uTime * 1.3 + aSeed * 12.0);
    vFade = uAssemble * mix(tw, 0.95, uMorph);
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
    gl_FragColor = vec4(vColor, a * vFade * 0.78);
  }
`;

const ASSEMBLE_END = 2.2;
const HOLD_END = 3.4;
const MORPH_END = 5.8;

function Points({ cloud }: { cloud: Cloud }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Points>(null);
  const t = useRef(0);

  const scatter = useMemo(
    () => makeScatter(cloud.count, cloud.height * 0.9),
    [cloud]
  );

  const uniforms = useMemo(
    () => ({
      uAssemble: { value: 0 },
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 3.6 },
    }),
    []
  );

  useFrame((state, d) => {
    t.current += d;
    if (!mat.current) return;

    const a = Math.min(1, t.current / ASSEMBLE_END);
    mat.current.uniforms.uAssemble.value = 1 - Math.pow(1 - a, 3);

    const m =
      t.current <= HOLD_END
        ? 0
        : Math.min(1, (t.current - HOLD_END) / (MORPH_END - HOLD_END));
    // ease-in-out so the globe lets go slowly and the figure lands softly
    mat.current.uniforms.uMorph.value =
      m < 0.5 ? 4 * m * m * m : 1 - Math.pow(-2 * m + 2, 3) / 2;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;

    if (grp.current) {
      const morph = mat.current.uniforms.uMorph.value;
      // spins freely as a globe, then settles to face the viewer
      const spin = grp.current.rotation.y + d * 0.5 * (1 - morph);
      const sway = Math.sin(state.clock.elapsedTime * 0.32) * 0.2;
      grp.current.rotation.y = THREE.MathUtils.lerp(spin, sway, morph * 0.16);
    }
  });

  return (
    <points ref={grp}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[cloud.sphere, 3]} />
        <bufferAttribute attach="attributes-aFigure" args={[cloud.figure, 3]} />
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

export default function HeroCloud({ className }: { className?: string }) {
  const lowPower = useSystem((s) => s.lowPower);
  const [cloud, setCloud] = useState<Cloud | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCloudImage()
      .then((img) => {
        if (cancelled) return;
        setCloud(buildCloud(img, { height: 4.6, target: lowPower ? 7000 : 15000 }));
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
