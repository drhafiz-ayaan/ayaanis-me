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

/**
 * A quadcopter sampled as points, matching an arbitrary point count.
 *
 * Built from primitives rather than a model file: the whole scene is one
 * BufferGeometry, so the drone has to be expressible as positions in the same
 * array the figure uses. A loaded mesh would mean a second draw call and a
 * second asset on the critical path for something on screen for four seconds.
 */
/** Writes one point sampled on a quadcopter of `scale` into out[i*3..i*3+2]. */
function sampleDronePoint(out: Float32Array, i: number, scale: number) {
  const HUB = 0.62 * scale;
  const hubs: [number, number][] = [
    [HUB, HUB],
    [-HUB, HUB],
    [HUB, -HUB],
    [-HUB, -HUB],
  ];

  // part budget: rotors read as "drone" most strongly, so they get the most
  const wBody = 0.24;
  const wArms = 0.18;
  const wRotor = 0.46;
  // remainder -> gimbal

  const r = Math.random();
  let x = 0;
  let y = 0;
  let z = 0;

  if (r < wBody) {
    // fuselage
    x = (Math.random() - 0.5) * 0.62 * scale;
    y = (Math.random() - 0.5) * 0.2 * scale;
    z = (Math.random() - 0.5) * 0.8 * scale;
  } else if (r < wBody + wArms) {
    // an arm running from the body out to a hub
    const [hx, hz] = hubs[(Math.random() * 4) | 0];
    const t = Math.random();
    x = hx * t + (Math.random() - 0.5) * 0.05 * scale;
    y = (Math.random() - 0.5) * 0.05 * scale;
    z = hz * t + (Math.random() - 0.5) * 0.05 * scale;
  } else if (r < wBody + wArms + wRotor) {
    // rotor disc: biased to the rim so it reads as a ring, not a blob
    const [hx, hz] = hubs[(Math.random() * 4) | 0];
    const a = Math.random() * Math.PI * 2;
    const rad = (0.26 + Math.random() * 0.11) * scale;
    x = hx + Math.cos(a) * rad;
    y = 0.1 * scale + (Math.random() - 0.5) * 0.03 * scale;
    z = hz + Math.sin(a) * rad;
  } else {
    // gimbal camera slung under the nose
    x = (Math.random() - 0.5) * 0.16 * scale;
    y = -0.2 * scale - Math.random() * 0.14 * scale;
    z = 0.26 * scale + (Math.random() - 0.5) * 0.16 * scale;
  }

  out[i * 3] = x;
  out[i * 3 + 1] = y;
  out[i * 3 + 2] = z;
}

export function makeDronePoints(count: number, scale = 1) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) sampleDronePoint(out, i, scale);
  return out;
}

export interface Swarm {
  /** xyz per point: the drone shape, offset to its place in the formation */
  swarm: Float32Array;
  /** xyz per point: the centre of the drone this point belongs to */
  home: Float32Array;
}

/**
 * A formation of small drones surrounding the figure's position.
 *
 * `home` is carried separately so the shader can move whole drones without
 * deforming them: subtract home to get a point's offset within its own
 * airframe, interpolate home along the flight path, add the offset back. A
 * single lerp of `swarm` would instead shrink every drone toward the origin as
 * it flew, which reads as melting rather than approaching.
 *
 * Points are handed out to drones in contiguous blocks, and the figure's
 * points run top to bottom, so each drone ends up responsible for one
 * horizontal band of the body. The dissolve then looks like the formation
 * depositing the figure in slices rather than a uniform fog collapsing.
 */
export function makeSwarm(
  count: number,
  scale: number,
  drones: number,
  spread: number
): Swarm {
  const swarm = new Float32Array(count * 3);
  const home = new Float32Array(count * 3);

  // Ring formation, deterministic rather than random: a fixed arrangement
  // reads as a flight plan, and a random one reads as debris.
  const centres: [number, number, number][] = [];
  for (let d = 0; d < drones; d++) {
    const a = (d / drones) * Math.PI * 2 + 0.5;
    const rad = spread * (0.66 + 0.34 * ((d * 7) % 5) / 4);
    centres.push([
      Math.cos(a) * rad,
      (((d * 13) % 7) / 6 - 0.5) * spread * 1.6,
      Math.sin(a) * rad * 0.55,
    ]);
  }

  const per = Math.ceil(count / drones);
  for (let i = 0; i < count; i++) {
    const c = centres[Math.min(drones - 1, (i / per) | 0)];
    sampleDronePoint(swarm, i, scale);
    swarm[i * 3] += c[0];
    swarm[i * 3 + 1] += c[1];
    swarm[i * 3 + 2] += c[2];
    home[i * 3] = c[0];
    home[i * 3 + 1] = c[1];
    home[i * 3 + 2] = c[2];
  }
  return { swarm, home };
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

// Versioned filename on purpose: next.config serves /avatar/* as immutable, so
// a portrait replaced in place would stay stale for every returning visitor.
// Bump the suffix whenever the source photo changes.
export const CLOUD_SRC = "/avatar/ayaan-cloud-v2.png";

/** Load the portrait once; the browser cache serves the second consumer. */
export function loadCloudImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cloud image failed to load"));
    img.src = CLOUD_SRC;
  });
}
