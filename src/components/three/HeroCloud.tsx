"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";
import {
  buildCloud,
  makeScatter,
  makeDronePoints,
  loadCloudImage,
  type Cloud,
} from "@/lib/cloud";
import { roleModes } from "@/content/profile";
import { SEQ } from "@/lib/sequence";

/**
 * Landing hero, as a single THREE.Points and one draw call.
 *
 * Opening sequence: scattered particles gather into a survey drone, the drone
 * holds station while the loading bar fills, it flies out toward the subject's
 * position, then the swarm bursts and resolves into Ayaan.
 *
 * Every stage is a position target in the same buffer — scatter, drone, figure
 * — blended in the vertex shader. Nothing is instantiated or destroyed mid
 * sequence, so the whole thing costs exactly one draw call from first frame to
 * last.
 */

const VERT = /* glsl */ `
  uniform float uAssemble;   // scatter -> drone
  uniform float uMorph;      // drone   -> figure
  uniform float uTime;
  uniform float uSize;
  uniform vec3  uFlight;     // where the drone has flown to
  uniform vec3  uRoleTint;
  uniform float uRoleAmt;
  uniform float uRoleMode;

  attribute vec3 aScatter;
  attribute vec3 aFigure;
  attribute vec3 aColor;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    // stage 1-3: particles gather into the drone, which then translates
    vec3 dronePos = mix(aScatter, position, uAssemble) + uFlight;

    // stage 4: dissolve into the figure, with an outward burst on the way so
    // the drone visibly comes apart instead of sliding into a new shape
    float burst = sin(uMorph * 3.14159265) * 0.7;
    vec3 pos = mix(dronePos, aFigure, uMorph) + normalize(aScatter) * burst;

    float idle = mix(0.035, 0.014, uMorph);
    pos.x += sin(uTime * 0.5 + aSeed * 9.0) * idle;
    pos.z += cos(uTime * 0.43 + aSeed * 7.0) * idle;

    // role expression, only once the figure has formed
    float rm = uRoleAmt * uMorph;
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

    // cyan hardware while it is a drone, true colour once it is a person
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

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Where the drone holds station while it scans, before closing on the subject. */
const HOLD = new THREE.Vector3(1.15, 1.45, 0.55);

function Points({ cloud }: { cloud: Cloud }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Points>(null);
  const t = useRef(0);
  const flyRef = useRef(0);
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

  const uniforms = useMemo(
    () => ({
      uAssemble: { value: 0 },
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 2.85 },
      uFlight: { value: new THREE.Vector3() },
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
      ? Math.max(t.current, SEQ.morphEnd)
      : t.current + d;
    const time = t.current;

    u.uAssemble.value = easeOutCubic(clamp01(time / SEQ.assembleEnd));

    // Flight path. The drone surveys from a standoff position up and to the
    // side, then closes on the subject: uFlight runs from HOLD down to zero,
    // so the drone arrives exactly where the figure is about to appear and
    // comes apart there. The sine terms bow the path into an arc, so it banks
    // in rather than sliding down a straight line.
    const fly = easeInOutCubic(
      clamp01((time - SEQ.scanEnd) / (SEQ.flyEnd - SEQ.scanEnd))
    );
    flyRef.current = fly;
    const away = 1 - fly;
    const arc = Math.sin(fly * Math.PI);
    (u.uFlight.value as THREE.Vector3).set(
      HOLD.x * away - arc * 0.35,
      HOLD.y * away,
      HOLD.z * away + arc * 0.5
    );

    u.uMorph.value = easeInOutCubic(
      clamp01((time - SEQ.flyEnd) / (SEQ.morphEnd - SEQ.flyEnd))
    );
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
      const morph = u.uMorph.value as number;
      // the drone yaws on station, then the figure settles to face you
      const spin = grp.current.rotation.y + d * 0.55 * (1 - morph);
      const sway = Math.sin(state.clock.elapsedTime * 0.32) * 0.2;
      grp.current.rotation.y = THREE.MathUtils.lerp(spin, sway, morph * 0.2);

      // A quadcopter is a horizontal object, so a level camera sees it edge-on
      // as a smear. Tilt the view down onto it while it is a drone, then level
      // off as the figure — which is vertical — takes over.
      grp.current.rotation.x = THREE.MathUtils.lerp(-0.5, 0, morph);

      // bank into the approach, level off as it arrives and comes apart
      grp.current.rotation.z =
        Math.sin(flyRef.current * Math.PI) * (1 - morph) * 0.28;
    }
  });

  return (
    <points ref={grp}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[drone, 3]} />
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
