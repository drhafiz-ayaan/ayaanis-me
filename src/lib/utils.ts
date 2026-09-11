import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clamp a number into [min, max]. */
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Deterministic 0–1 hash so visuals are identical on every render/build. */
export function hash01(x: number, y = 0) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
