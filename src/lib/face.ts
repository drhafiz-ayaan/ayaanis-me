/**
 * The background face hologram: the head crop sampled as a grid of points.
 *
 * Rendered as points rather than as a textured plane on purpose. The source
 * carries about 250px of head, and a plane blown up to fill a screen at that
 * resolution is just a blurry photograph. Sampled on a grid the same pixels
 * become a dot-matrix readout, where the coarseness is the aesthetic instead
 * of a defect — which is how scan displays in this idiom actually look.
 */

export interface FaceGrid {
  positions: Float32Array;
  colors: Float32Array;
  /** 0..1 across and down the source, for scanline and glitch banding */
  uv: Float32Array;
  count: number;
  width: number;
  height: number;
}

export const FACE_SRC = "/avatar/ayaan-face-v1.png";

export function buildFaceGrid(
  img: HTMLImageElement,
  { step = 2, height = 8.6 } = {}
): FaceGrid | null {
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

  const sc = height / H;
  const width = W * sc;

  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];

  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (px[i + 3] < 130) continue;

      pos.push((x - W / 2) * sc, (H / 2 - y) * sc, 0);

      const r = px[i] / 255;
      const g = px[i + 1] / 255;
      const b = px[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Luminance-led, with a deliberately small floor. A large floor lifts
      // hair and skin to nearly the same value and the head arrives as a flat
      // silhouette; keeping it low lets the dark hair and glasses fall away and
      // the lit planes — brow, cheekbone, nose, jaw — carry the likeness, which
      // is how a projected scan reads.
      // Luminance-led rather than colour-led. A hologram of a face is read
      // through its modelling — brow, cheekbone, jaw — and carrying the
      // photograph's actual skin hue across a nine-unit-tall projection makes
      // it look like a pasted cut-out rather than something being displayed.
      col.push(
        0.02 + lum * 0.55,
        0.10 + lum * 1.15,
        0.16 + lum * 1.25
      );

      uv.push(x / W, y / H);
    }
  }

  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    uv: new Float32Array(uv),
    count: uv.length / 2,
    width,
    height,
  };
}

export function loadFaceImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("face image failed to load"));
    img.src = FACE_SRC;
  });
}
