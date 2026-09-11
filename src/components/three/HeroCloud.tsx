"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";
import { buildCloud, makeScatter, loadCloudImage, type Cloud } from "@/lib/cloud";
import { roleModes } from "@/content/profile";

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
  uniform vec3  uRoleTint;
  uniform float uRoleAmt;   // 0..1, ramps as a role is hovered
  uniform float uRoleMode;  // 0..3, which behaviour to express

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

    // Role expression. uRoleMode is a uniform, so this branch is coherent
    // across every vertex and costs effectively nothing on the GPU. Only
    // applies once the figure has formed — displacing a half-morphed cloud
    // just reads as noise.
    float rm = uRoleAmt * uMorph;
    if (rm > 0.001) {
      vec3 disp;
      if (uRoleMode < 0.5) {
        // AI: high-frequency search, a field still resolving
        disp = vec3(
          sin(uTime * 7.0 + aSeed * 31.0),
          cos(uTime * 6.3 + aSeed * 17.0),
          sin(uTime * 5.1 + aSeed * 23.0)
        ) * 0.055;
      } else if (uRoleMode < 1.5) {
        // Robotics: snap to a lattice — discretised, mechanical, repeatable
        float st = 0.14;
        disp = (floor(pos / st) * st + st * 0.5) - pos;
      } else if (uRoleMode < 2.5) {
        // Digital twin: horizontal scan bands sweeping the body
        disp = vec3(0.0, 0.0, sin(pos.y * 8.0 - uTime * 2.6) * 0.12);
      } else {
        // Founder: contract — scattered work pulled into one thing
        disp = -pos * 0.085;
      }
      pos += disp * rm;
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z) * (1.0 + rm * 0.25);

    // cyan while it is still a globe, true colour once it is a person,
    // then pushed toward the hovered role's accent
    vec3 cyan = vec3(0.15, 0.68, 0.80);
    vColor = mix(mix(cyan, aColor, uMorph), uRoleTint, rm * 0.72);

    float tw = 0.72 + 0.28 * sin(uTime * 1.3 + aSeed * 12.0);
    vFade = uAssemble * mix(tw, 0.95, uMorph) * (1.0 + rm * 0.35);
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
  const activeRole = useSystem((s) => s.activeRole);

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
      uRoleTint: { value: new THREE.Color("#22d3ee") },
      uRoleAmt: { value: 0 },
      uRoleMode: { value: 0 },
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

    // Ramp the role influence rather than snapping it, so moving along the
    // role list reads as the cloud changing behaviour, not flicking between
    // presets. The tint is set immediately; uRoleAmt does the easing.
    const u = mat.current.uniforms;
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
