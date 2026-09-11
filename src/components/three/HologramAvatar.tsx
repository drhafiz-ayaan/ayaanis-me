"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSystem } from "@/store/useSystem";

/**
 * Point-cloud hologram built from a segmented portrait.
 *
 * `/avatar/ayaan-cloud.png` is the subject only — background already knocked
 * out to alpha 0 at build time. Here we read its pixels once, turn every
 * opaque one into a particle, and infer volume from the silhouette: for each
 * row we measure the figure's width and push points onto an elliptical
 * cross-section, so the cloud has real depth instead of being a flat cutout.
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

    // idle drift so the cloud never looks frozen
    pos.x += sin(uTime * 0.5 + aSeed * 9.0) * 0.012;
    pos.z += cos(uTime * 0.42 + aSeed * 7.0) * 0.018;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (6.0 / -mv.z);

    // scan line travelling up the body, the classic hologram tell
    float scan = smoothstep(0.16, 0.0, abs(fract(uTime * 0.14) * 2.6 - 1.3 - pos.y));

    vColor = aColor + vec3(0.05, 0.35, 0.45) * scan;
    vFade = p * (0.55 + 0.45 * sin(uTime * 1.1 + aSeed * 6.0) * 0.35 + scan * 0.5);
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
    gl_FragColor = vec4(vColor, a * vFade * 0.85);
  }
`;

interface CloudData {
  positions: Float32Array;
  scatter: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  count: number;
}

/** Read the segmented PNG and turn it into a volumetric point cloud. */
function buildCloud(img: HTMLImageElement, stride: number): CloudData | null {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;

  // figure extent per row, used to give the silhouette volume
  const rowMin = new Int32Array(H).fill(W);
  const rowMax = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        if (x < rowMin[y]) rowMin[y] = x;
        if (x > rowMax[y]) rowMax[y] = x;
      }
    }
  }

  const HEIGHT = 4.6; // world units tall
  const sc = HEIGHT / H;

  const pos: number[] = [];
  const sca: number[] = [];
  const col: number[] = [];
  const sd: number[] = [];

  for (let y = 0; y < H; y += stride) {
    const lo = rowMin[y];
    const hi = rowMax[y];
    if (hi < lo) continue;
    const mid = (lo + hi) / 2;
    const half = Math.max(1, (hi - lo) / 2);

    for (let x = lo; x <= hi; x += stride) {
      const i = (y * W + x) * 4;
      if (data[i + 3] <= 128) continue;

      // elliptical cross-section: centre of the row sits closest to camera
      const t = (x - mid) / half;
      const depth = Math.sqrt(Math.max(0, 1 - t * t)) * half * sc * 0.82;
      // half the points go to the back shell so the cloud has real thickness
      const front = ((x + y) & 1) === 0;

      pos.push(
        (x - W / 2) * sc,
        (H / 2 - y) * sc,
        front ? depth : -depth * 0.72
      );

      const r = 3.6 + Math.random() * 2.2;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      sca.push(
        Math.sin(b) * Math.cos(a) * r,
        Math.cos(b) * r,
        Math.sin(b) * Math.sin(a) * r
      );

      // Real colour pushed toward cyan, over an emission floor. Without the
      // floor a black suit maps to near-zero and most of the body vanishes;
      // a hologram is projected light, so even its darks should glow.
      const cr = data[i] / 255;
      const cg = data[i + 1] / 255;
      const cb = data[i + 2] / 255;
      const lum = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
      col.push(
        0.04 + cr * 0.28 + lum * 0.1,
        0.26 + cg * 0.35 + lum * 0.55,
        0.34 + cb * 0.3 + lum * 0.6
      );

      sd.push(Math.random());
    }
  }

  return {
    positions: new Float32Array(pos),
    scatter: new Float32Array(sca),
    colors: new Float32Array(col),
    seeds: new Float32Array(sd),
    count: sd.length,
  };
}

function Cloud({ data }: { data: CloudData }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Points>(null);
  const elapsed = useRef(0);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 3.4 },
    }),
    []
  );

  useFrame((s, d) => {
    elapsed.current += d;
    if (mat.current) {
      mat.current.uniforms.uProgress.value = Math.min(1, elapsed.current / 2.2);
      mat.current.uniforms.uTime.value = s.clock.elapsedTime;
    }
    if (grp.current) {
      // gentle turntable that never shows the thin side-on profile
      grp.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.22) * 0.42;
    }
  });

  return (
    <points ref={grp}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aScatter" args={[data.scatter, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[data.seeds, 1]} />
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
  const [data, setData] = useState<CloudData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = "/avatar/ayaan-cloud.png";
    img.onload = () => {
      if (cancelled) return;
      // stride 2 keeps the cloud near ~16k points on a 180x375 source
      setData(buildCloud(img, lowPower ? 3 : 2));
    };
    img.onerror = () => !cancelled && setFailed(true);
    return () => {
      cancelled = true;
    };
  }, [lowPower]);

  if (failed) return null;

  return (
    <div className={className}>
      {!data && (
        <div className="flex h-full items-center justify-center">
          <span className="label-hud animate-pulse">Reconstructing…</span>
        </div>
      )}
      {data && (
        <Canvas
          camera={{ position: [0, 0, 6.4], fov: 42 }}
          dpr={lowPower ? 1 : [1, 1.75]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          style={{ pointerEvents: "none" }}
        >
          <Cloud data={data} />
        </Canvas>
      )}
    </div>
  );
}
