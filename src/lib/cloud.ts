/**
 * Turns the segmented portrait PNG into a volumetric point cloud.
 *
 * Shared by the Mission Briefing hologram and the landing hero, so both read
 * the same asset and the same geometry rules.
 */

export interface Cloud {
  /** xyz per point, figure shape */
  figure: Float32Array;
  /** xyz per point, sphere shape (same count, for morphing) */
  sphere: Float32Array;
  /** rgb per point, sampled from the photo and pushed toward cyan */
  colors: Float32Array;
  /** 0–1 per point */
  seeds: Float32Array;
  count: number;
  /** world-space height the figure was scaled to */
  height: number;
}

export interface CloudOptions {
  /** world-space height for the figure */
  height?: number;
  /** rough number of points to aim for */
  target?: number;
  /** how far the silhouette is pushed into depth, relative to row half-width */
  depth?: number;
}

export function buildCloud(
  img: HTMLImageElement,
  { height = 4.6, target = 14000, depth = 0.8 }: CloudOptions = {}
): Cloud | null {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return null;

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, W, H).data;

  // opaque pixel count decides the stride needed to land near `target`
  let opaque = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 128) opaque++;
  if (!opaque) return null;
  const stride = Math.max(1, Math.round(Math.sqrt(opaque / target)));

  // figure extent per row gives the silhouette its volume
  const rowMin = new Int32Array(H).fill(W);
  const rowMax = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] > 128) {
        if (x < rowMin[y]) rowMin[y] = x;
        if (x > rowMax[y]) rowMax[y] = x;
      }
    }
  }

  const sc = height / H;
  const fig: number[] = [];
  const col: number[] = [];
  const sd: number[] = [];

  // Alternates front/back per emitted point. Deriving it from (x + y) parity
  // was a bug: with an even stride the parity never changes, so every point
  // landed on the front shell and the cloud was flat.
  let flip = 0;

  for (let y = 0; y < H; y += stride) {
    const lo = rowMin[y];
    const hi = rowMax[y];
    if (hi < lo) continue;
    const mid = (lo + hi) / 2;
    const half = Math.max(1, (hi - lo) / 2);

    for (let x = lo; x <= hi; x += stride) {
      const i = (y * W + x) * 4;
      if (px[i + 3] <= 128) continue;

      const t = (x - mid) / half;
      const z = Math.sqrt(Math.max(0, 1 - t * t)) * half * sc * depth;
      flip ^= 1;

      fig.push(
        (x - W / 2) * sc,
        (H / 2 - y) * sc,
        flip ? z : -z * 0.7
      );

      // Real colour over a cyan emission floor. Mapping the suit's true
      // colour alone puts most of the body at near-zero and the figure
      // disappears — projected light glows even in its darks.
      const r = px[i] / 255;
      const g = px[i + 1] / 255;
      const b = px[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      col.push(
        0.05 + r * 0.3 + lum * 0.12,
        0.27 + g * 0.36 + lum * 0.56,
        0.35 + b * 0.3 + lum * 0.62
      );

      sd.push(Math.random());
    }
  }

  const count = sd.length;

  // matching sphere, so the two shapes can morph point-for-point
  const sph = new Float32Array(count * 3);
  const radius = height * 0.34;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const yy = 1 - (i / Math.max(1, count - 1)) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const th = golden * i;
    sph[i * 3] = Math.cos(th) * rr * radius;
    sph[i * 3 + 1] = yy * radius;
    sph[i * 3 + 2] = Math.sin(th) * rr * radius;
  }

  return {
    figure: new Float32Array(fig),
    sphere: sph,
    colors: new Float32Array(col),
    seeds: new Float32Array(sd),
    count,
    height,
  };
}

/** Scattered start positions, one shell per point. */
export function makeScatter(count: number, radius: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * (1 + Math.random() * 1.4);
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    out[i * 3] = Math.sin(b) * Math.cos(a) * r;
    out[i * 3 + 1] = Math.cos(b) * r;
    out[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
  }
  return out;
}

export const CLOUD_SRC = "/avatar/ayaan-cloud.png";

/** Load the portrait once; the browser cache serves the second consumer. */
export function loadCloudImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cloud image failed to load"));
    img.src = CLOUD_SRC;
  });
}
