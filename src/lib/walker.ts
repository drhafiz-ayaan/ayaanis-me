/**
 * A walking humanoid built out of points, shaped and coloured from the
 * portrait.
 *
 * Why procedural rather than a model file: a single front-facing photograph
 * contains no information about the back of a head, the sides of a body, or
 * anything an arm is covering. Single-image-to-3D reconstruction fills those
 * in by guessing, and the guesses are what make those results look melted. So
 * the figure's *geometry* is a rigged humanoid solved analytically, and the
 * photo is used for the two things it genuinely carries: the subject's
 * proportions, and the subject's colour at every height of the body.
 *
 * Skinning happens in the vertex shader. Each point stores which bone it
 * belongs to, how far along that bone it sits, and its offset from the bone
 * axis. Posing therefore costs fourteen bone transforms per frame on the CPU
 * regardless of how many points there are, and the buffers never change after
 * they are built.
 */

export const BONES = 16;

export const BONE = {
  spineLow: 0,
  spineUp: 1,
  head: 2,
  upperArmL: 3,
  foreArmL: 4,
  upperArmR: 5,
  foreArmR: 6,
  thighL: 7,
  shinL: 8,
  footL: 9,
  thighR: 10,
  shinR: 11,
  footR: 12,
  pelvis: 13,
  /**
   * Clavicles. Without them the arms begin in mid-air at the shoulder joint
   * while the spine has already tapered to a neck, so the upper arms read as
   * two wings hanging off nothing. These carry the deltoid mass that joins
   * the two.
   */
  clavL: 14,
  clavR: 15,
} as const;

/**
 * Radius at each end of a bone, how much it is flattened front-to-back, and
 * how far its profile is rounded off — all as fractions of total body height.
 *
 * `round` is what stops the figure reading as a stack of boxes. At 0 a bone
 * is a cone: constant cross-section, hard flat ends. That is right for a
 * forearm, which is hidden inside a sleeve at both ends, and badly wrong for
 * a head, which has to close over at the crown and pinch in at the neck. At 1
 * the radius follows an ellipse along the bone's length.
 */
const SHAPE: Record<
  number,
  { rA: number; rB: number; depth: number; round: number; mass: number }
> = {
  [BONE.spineLow]: { rA: 0.090, rB: 0.108, depth: 0.62, round: 0.20, mass: 0.16 },
  [BONE.spineUp]: { rA: 0.108, rB: 0.038, depth: 0.62, round: 0.30, mass: 0.13 },
  [BONE.head]: { rA: 0.052, rB: 0.052, depth: 0.94, round: 0.92, mass: 0.11 },
  [BONE.upperArmL]: { rA: 0.040, rB: 0.031, depth: 1, round: 0.10, mass: 0.042 },
  [BONE.foreArmL]: { rA: 0.031, rB: 0.024, depth: 1, round: 0.10, mass: 0.033 },
  [BONE.upperArmR]: { rA: 0.040, rB: 0.031, depth: 1, round: 0.10, mass: 0.042 },
  [BONE.foreArmR]: { rA: 0.031, rB: 0.024, depth: 1, round: 0.10, mass: 0.033 },
  [BONE.thighL]: { rA: 0.058, rB: 0.042, depth: 1, round: 0.14, mass: 0.09 },
  [BONE.shinL]: { rA: 0.042, rB: 0.026, depth: 1, round: 0.14, mass: 0.07 },
  [BONE.footL]: { rA: 0.028, rB: 0.019, depth: 1, round: 0.25, mass: 0.026 },
  [BONE.thighR]: { rA: 0.058, rB: 0.042, depth: 1, round: 0.14, mass: 0.09 },
  [BONE.shinR]: { rA: 0.042, rB: 0.026, depth: 1, round: 0.14, mass: 0.07 },
  [BONE.footR]: { rA: 0.028, rB: 0.019, depth: 1, round: 0.25, mass: 0.026 },
  [BONE.pelvis]: { rA: 0.092, rB: 0.092, depth: 0.62, round: 0.35, mass: 0.06 },
  [BONE.clavL]: { rA: 0.068, rB: 0.050, depth: 0.72, round: 0.30, mass: 0.031 },
  [BONE.clavR]: { rA: 0.068, rB: 0.050, depth: 0.72, round: 0.30, mass: 0.031 },
};

/** Heights as fractions of total body height, measured from the ground. */
export interface Rig {
  height: number;
  ankleY: number;
  kneeY: number;
  hipY: number;
  chestY: number;
  neckY: number;
  shoulderY: number;
  /** half the distance between the shoulder joints */
  shoulderHalf: number;
  /** half the distance between the hip joints */
  hipHalf: number;
  upperArm: number;
  foreArm: number;
  footLen: number;
}

/**
 * Reads build from the portrait's silhouette.
 *
 * Only the measurements a photograph can actually support are taken from it —
 * how broad the shoulders are, how wide the hips are, and where the legs
 * separate. Everything else uses standard proportion, because a front-on
 * still cannot resolve it and inventing it from the same pixels would just be
 * noise dressed as data.
 */
export function measureRig(
  px: Uint8ClampedArray,
  W: number,
  H: number,
  height: number
): Rig {
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

  // widest row in the upper third is the shoulder line
  let shoulderRow = 0;
  let widest = 0;
  for (let y = 0; y < ((H / 3) | 0); y++) {
    const w = rowMax[y] - rowMin[y];
    if (w > widest) {
      widest = w;
      shoulderRow = y;
    }
  }

  // The crotch is the HIGHEST row that still splits into two runs. Scanning
  // upward from the feet finds it; scanning down from the head would stop at
  // the first gap between an arm and the torso instead.
  //
  // The split has to be seen before a single run can end the search. Breaking
  // on the first one-run row finds the bottom-most shoe — at that height only
  // the lower foot is in contact — which collapses the hips to the floor and
  // leaves the figure legless.
  const runsAt = (y: number) => {
    const minRun = Math.max(2, W * 0.02);
    let runs = 0;
    let len = 0;
    for (let x = rowMin[y]; x <= rowMax[y]; x++) {
      if (px[(y * W + x) * 4 + 3] > 128) {
        len++;
      } else {
        if (len >= minRun) runs++;
        len = 0;
      }
    }
    if (len >= minRun) runs++;
    return runs;
  };

  let crotchRow = (H * 0.52) | 0;
  let seenSplit = false;
  for (let y = H - 1; y > H * 0.3; y--) {
    if (rowMax[y] < rowMin[y]) continue;
    if (runsAt(y) >= 2) {
      seenSplit = true;
      crotchRow = y;
    } else if (seenSplit) {
      break;
    }
  }

  const toFrac = (row: number) => 1 - row / H;
  const perPx = height / H;

  // Every measurement is clamped to the range a human body can actually
  // occupy. A photo can be cropped oddly, lit oddly, or have a shadow join the
  // silhouette; the failure mode of trusting it is a skeleton with no legs,
  // which is far worse than a skeleton with slightly generic proportions.
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi * height, Math.max(lo * height, v));

  const hipRow = Math.max(0, (crotchRow - H * 0.04) | 0);
  // The widest row spans the outside of both arms, so the shoulder *joints*
  // sit inboard of it by roughly an arm's radius on each side. Taking the
  // full half-width as the joint separation is what throws the arms out wide.
  const shoulderHalf = clamp((widest / 2) * perPx * 0.66, 0.085, 0.145);
  const hipHalf = clamp(
    ((rowMax[hipRow] - rowMin[hipRow]) / 2) * perPx * 0.52,
    0.05,
    0.095
  );

  const hipY = clamp(toFrac(crotchRow) * height, 0.44, 0.58);
  const shoulderY = clamp(toFrac(shoulderRow) * height, 0.76, 0.84);

  return {
    height,
    ankleY: 0.045 * height,
    kneeY: hipY * 0.52,
    hipY,
    chestY: shoulderY * 0.88,
    // The head occupies the top ~13.5% of a body, so the skull base sits a
    // fixed distance above the shoulder line rather than a fraction of it —
    // scaling it proportionally leaves a broad-shouldered subject with no
    // room left for a head.
    neckY: shoulderY + 0.042 * height,
    shoulderY,
    shoulderHalf,
    hipHalf,
    upperArm: 0.175 * height,
    foreArm: 0.155 * height,
    footLen: 0.075 * height,
  };
}

export interface Walker {
  /** per point: which bone it is attached to */
  bone: Float32Array;
  /** per point: 0..1 along that bone */
  t: Float32Array;
  /** per point: offset from the bone axis, x across and z front-to-back */
  offset: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  count: number;
  rig: Rig;
}

/**
 * Distributes points over the body and colours them from the portrait.
 *
 * Colour is sampled by body height rather than by projecting a rest pose:
 * for a point at a given height, the photo's own silhouette extent at that
 * height says where the body's left and right edges are, so the point's
 * position across the body maps straight onto the corresponding pixel. Head
 * points land on hair and face, chest points on lapels and tie, wrist points
 * on skin and watch, and the bottom of the legs on shoes.
 */
export function buildWalker(
  img: HTMLImageElement,
  { count = 18000, height = 3.0 } = {}
): Walker | null {
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

  const rig = measureRig(px, W, H, height);

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

  const bone = new Float32Array(count);
  const tArr = new Float32Array(count);
  const offset = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  // rest-pose bone endpoints, used only to know each point's height for colour
  const restA = new Float32Array(BONES * 3);
  const restB = new Float32Array(BONES * 3);
  poseRest(rig, restA, restB);

  // cumulative mass so a uniform random picks a bone in proportion to volume
  const cum: number[] = [];
  let acc = 0;
  for (let b = 0; b < BONES; b++) {
    acc += SHAPE[b].mass;
    cum.push(acc);
  }

  for (let i = 0; i < count; i++) {
    const r = Math.random() * acc;
    let b = 0;
    while (b < BONES - 1 && r > cum[b]) b++;
    const s = SHAPE[b];

    const t = Math.random();
    // Radius tapers along the bone, then the rounding profile closes the ends
    // off. sqrt on the random keeps the disc evenly filled by area rather than
    // crowding every point toward the axis.
    const ell = Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));
    const profile = 1 - s.round + s.round * ell;
    const rad =
      (s.rA + (s.rB - s.rA) * t) * profile * height * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;

    bone[i] = b;
    tArr[i] = t;
    offset[i * 3] = Math.cos(a) * rad;
    offset[i * 3 + 1] = 0;
    offset[i * 3 + 2] = Math.sin(a) * rad * s.depth;

    // --- colour, from the point's height in the rest pose -------------------
    const ay = restA[b * 3 + 1];
    const by = restB[b * 3 + 1];
    const ax = restA[b * 3];
    const bx = restB[b * 3];
    const wy = ay + (by - ay) * t;
    const wx = ax + (bx - ax) * t + offset[i * 3];

    const hFrac = Math.min(0.999, Math.max(0, wy / height));
    let row = Math.min(H - 1, Math.max(0, Math.round((1 - hFrac) * (H - 1))));
    // rows can be empty at the very top; walk down to the first real one
    let guard = 0;
    while (rowMax[row] < rowMin[row] && row < H - 1 && guard++ < 40) row++;

    const lo = rowMin[row];
    const hi = rowMax[row];
    let cr = 0.18;
    let cg = 0.22;
    let cb = 0.28;
    if (hi >= lo) {
      const xn = Math.max(-1, Math.min(1, wx / (rig.shoulderHalf * 1.25)));
      const sx = Math.round(lo + ((xn + 1) / 2) * (hi - lo));
      const o = (row * W + Math.min(hi, Math.max(lo, sx))) * 4;
      if (px[o + 3] > 128) {
        cr = px[o] / 255;
        cg = px[o + 1] / 255;
        cb = px[o + 2] / 255;
      }
    }

    // A black suit sits near zero in every channel, so lit by itself the
    // figure would be invisible against a black page. Keep the photo's hue
    // relationships but raise the whole thing onto a cyan floor, the same
    // treatment the hologram gets, so the two read as the same person.
    // The emission floor has to be high enough that a black suit is visible on
    // a black page, but low enough that it does not swamp the photo and flatten
    // the whole body to one cyan. These weights keep roughly a 2:1 range
    // between the suit and the face, which is what makes the head, collar and
    // hands separate from the jacket instead of dissolving into it.
    const lum = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
    colors[i * 3] = 0.04 + cr * 0.50 + lum * 0.20;
    colors[i * 3 + 1] = 0.16 + cg * 0.50 + lum * 0.55;
    colors[i * 3 + 2] = 0.22 + cb * 0.45 + lum * 0.62;

    seeds[i] = Math.random();
  }

  return { bone, t: tArr, offset, colors, seeds, count, rig };
}

/* ------------------------------------------------------------------ posing */

const TAU = Math.PI * 2;

function setBone(
  A: Float32Array,
  B: Float32Array,
  i: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
) {
  A[i * 3] = ax;
  A[i * 3 + 1] = ay;
  A[i * 3 + 2] = az;
  B[i * 3] = bx;
  B[i * 3 + 1] = by;
  B[i * 3 + 2] = bz;
}

/** Standing, arms down — used only to work out each point's height. */
function poseRest(rig: Rig, A: Float32Array, B: Float32Array) {
  const { hipY, chestY, neckY, height, shoulderY, shoulderHalf, hipHalf } = rig;
  setBone(A, B, BONE.spineLow, 0, hipY, 0, 0, chestY, 0);
  setBone(A, B, BONE.spineUp, 0, chestY, 0, 0, neckY, 0);
  setBone(A, B, BONE.head, 0, neckY, 0, 0, height, 0);
  setBone(A, B, BONE.pelvis, -hipHalf, hipY, 0, hipHalf, hipY, 0);

  for (const side of [-1, 1]) {
    const arm = side < 0 ? BONE.upperArmL : BONE.upperArmR;
    const fore = side < 0 ? BONE.foreArmL : BONE.foreArmR;
    const clav = side < 0 ? BONE.clavL : BONE.clavR;
    const sx = side * shoulderHalf;
    setBone(A, B, clav, 0, shoulderY, 0, sx, shoulderY, 0);
    setBone(A, B, arm, sx, shoulderY, 0, sx, shoulderY - rig.upperArm, 0);
    setBone(
      A, B, fore,
      sx, shoulderY - rig.upperArm, 0,
      sx, shoulderY - rig.upperArm - rig.foreArm, 0
    );

    const thigh = side < 0 ? BONE.thighL : BONE.thighR;
    const shin = side < 0 ? BONE.shinL : BONE.shinR;
    const foot = side < 0 ? BONE.footL : BONE.footR;
    const hx = side * hipHalf;
    setBone(A, B, thigh, hx, hipY, 0, hx, rig.kneeY, 0);
    setBone(A, B, shin, hx, rig.kneeY, 0, hx, rig.ankleY, 0);
    setBone(A, B, foot, hx, rig.ankleY, 0, hx, 0.012 * height, rig.footLen);
  }
}

export interface PoseResult {
  /** ground contact this frame, per side, for kicking up floor particles */
  contactL: boolean;
  contactR: boolean;
  footLX: number;
  footLZ: number;
  footRX: number;
  footRZ: number;
}

/**
 * Solves the walk cycle at time `time` into bone endpoints and bases.
 *
 * The pelvis height is not animated by hand. Both legs are solved with the
 * pelvis at zero, and the pelvis is then lifted so that whichever ankle is
 * lowest sits exactly at ground level. The vertical bob and the weight
 * transfer fall out of the leg geometry for free, and the feet cannot sink
 * through the floor or skate above it at any cadence.
 */
export function poseWalk(
  time: number,
  rig: Rig,
  cadence: number,
  A: Float32Array,
  B: Float32Array,
  right: Float32Array,
  fwd: Float32Array,
  prev: { lY: number; rY: number }
): PoseResult {
  const { hipY, height, shoulderHalf, hipHalf, ankleY } = rig;
  const thighLen = hipY - rig.kneeY;
  const shinLen = rig.kneeY - ankleY;

  const phase = (time * cadence) % 1;

  const HIP_SWING = 0.52;   // radians, thigh fore-and-aft
  const KNEE_MIN = 0.10;
  const KNEE_AMP = 0.95;
  const ARM_SWING = 0.40;

  // Solve one leg, pelvis at origin. Returns joint offsets relative to pelvis.
  const leg = (p: number) => {
    const th = HIP_SWING * Math.cos(TAU * p);
    const kn = KNEE_MIN + KNEE_AMP * Math.max(0, Math.sin(TAU * p + 0.75));
    const shinPitch = th - kn;
    const kneeYo = -thighLen * Math.cos(th);
    const kneeZo = thighLen * Math.sin(th);
    const ankYo = kneeYo - shinLen * Math.cos(shinPitch);
    const ankZo = kneeZo + shinLen * Math.sin(shinPitch);
    // ankle pitch keeps the foot roughly level with the ground
    const anklePitch = -shinPitch * 0.55 + 0.1;
    return { kneeYo, kneeZo, ankYo, ankZo, anklePitch };
  };

  const L = leg(phase);
  const R = leg(phase + 0.5);

  // lift the pelvis until the lower ankle rests on the ground
  const pelvisY = ankleY - Math.min(L.ankYo, R.ankYo);

  // torso counter-rotates against the hips, and leans very slightly into it
  const twist = Math.sin(TAU * phase) * 0.10;
  const lean = 0.05;
  // Head-on, the stride is foreshortened into depth and barely reads. Weight
  // shift and vertical bob are what sell an approaching walk from the front,
  // so the lateral sway is pushed well past what a side view would want.
  const sway = Math.sin(TAU * phase) * hipHalf * 0.45;

  const chestY = pelvisY + (rig.chestY - hipY);
  const neckY = pelvisY + (rig.neckY - hipY);
  const headY = pelvisY + (height - hipY);
  const shY = pelvisY + (rig.shoulderY - hipY);

  const leanZ = (y: number) => (y - pelvisY) * lean;

  setBone(A, B, BONE.spineLow,
    sway, pelvisY, 0,
    sway, chestY, leanZ(chestY));
  setBone(A, B, BONE.spineUp,
    sway, chestY, leanZ(chestY),
    sway, neckY, leanZ(neckY));
  setBone(A, B, BONE.head,
    sway, neckY, leanZ(neckY),
    sway, headY, leanZ(headY) * 0.6);
  setBone(A, B, BONE.pelvis,
    sway - hipHalf, pelvisY, 0,
    sway + hipHalf, pelvisY, 0);

  const res: PoseResult = {
    contactL: false,
    contactR: false,
    footLX: 0,
    footLZ: 0,
    footRX: 0,
    footRZ: 0,
  };

  for (const side of [-1, 1] as const) {
    const isL = side < 0;
    const lp = isL ? L : R;
    const p = isL ? phase : phase + 0.5;

    // --- arm, swinging opposite its own leg --------------------------------
    const shPitch = -ARM_SWING * Math.cos(TAU * p);
    const elFlex = 0.34 + 0.26 * Math.max(0, Math.sin(TAU * p + 1.1));
    // shoulders ride the torso twist
    const sx = sway + side * shoulderHalf * Math.cos(twist);
    const sz = leanZ(shY) - side * shoulderHalf * Math.sin(twist);

    const elbowY = shY - rig.upperArm * Math.cos(shPitch);
    const elbowZ = sz + rig.upperArm * Math.sin(shPitch);
    const forePitch = shPitch - elFlex;
    const wristY = elbowY - rig.foreArm * Math.cos(forePitch);
    const wristZ = elbowZ + rig.foreArm * Math.sin(forePitch);

    const arm = isL ? BONE.upperArmL : BONE.upperArmR;
    const fore = isL ? BONE.foreArmL : BONE.foreArmR;
    const clav = isL ? BONE.clavL : BONE.clavR;
    setBone(A, B, clav, sway, shY, leanZ(shY), sx, shY, sz);
    setBone(A, B, arm, sx, shY, sz, sx, elbowY, elbowZ);
    setBone(A, B, fore, sx, elbowY, elbowZ, sx, wristY, wristZ);

    // --- leg ----------------------------------------------------------------
    const hx = sway + side * hipHalf;
    const kneeY = pelvisY + lp.kneeYo;
    const kneeZ = lp.kneeZo;
    const ankY = pelvisY + lp.ankYo;
    const ankZ = lp.ankZo;
    const toeY = ankY - rig.footLen * Math.sin(lp.anklePitch) * 0.35;
    const toeZ = ankZ + rig.footLen * Math.cos(lp.anklePitch);

    const thigh = isL ? BONE.thighL : BONE.thighR;
    const shin = isL ? BONE.shinL : BONE.shinR;
    const foot = isL ? BONE.footL : BONE.footR;
    setBone(A, B, thigh, hx, pelvisY, 0, hx, kneeY, kneeZ);
    setBone(A, B, shin, hx, kneeY, kneeZ, hx, ankY, ankZ);
    setBone(A, B, foot, hx, ankY, ankZ, hx, toeY, toeZ);

    // A footfall is the frame where an ankle crosses into the contact band
    // from above. Testing height alone would fire every frame it rests there.
    const band = ankleY * 1.35;
    const was = isL ? prev.lY : prev.rY;
    const landed = ankY <= band && was > band;
    if (isL) {
      res.contactL = landed;
      res.footLX = hx;
      res.footLZ = ankZ;
      prev.lY = ankY;
    } else {
      res.contactR = landed;
      res.footRX = hx;
      res.footRZ = ankZ;
      prev.rY = ankY;
    }
  }

  // Bone bases. Limbs pitch in the sagittal plane, so crossing the bone
  // direction with world forward yields a stable sideways axis for all of
  // them; only a bone pointing exactly along +Z would be degenerate, and the
  // foot — the one bone that comes close — always keeps some downward tilt.
  for (let b = 0; b < BONES; b++) {
    let dx = B[b * 3] - A[b * 3];
    let dy = B[b * 3 + 1] - A[b * 3 + 1];
    let dz = B[b * 3 + 2] - A[b * 3 + 2];
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;

    // right = normalize(dir x +Z)
    let rx = dy * 1 - dz * 0;
    let ry = dz * 0 - dx * 1;
    let rz = 0;
    let rl = Math.hypot(rx, ry, rz);
    if (rl < 1e-4) {
      rx = 1;
      ry = 0;
      rz = 0;
      rl = 1;
    }
    rx /= rl;
    ry /= rl;
    rz /= rl;

    // fwd = right x dir
    const fx = ry * dz - rz * dy;
    const fy = rz * dx - rx * dz;
    const fz = rx * dy - ry * dx;

    right[b * 3] = rx;
    right[b * 3 + 1] = ry;
    right[b * 3 + 2] = rz;
    fwd[b * 3] = fx;
    fwd[b * 3 + 1] = fy;
    fwd[b * 3 + 2] = fz;
  }

  return res;
}
