"use client";

import { useEffect } from "react";
import { useSystem } from "@/store/useSystem";

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/**
 * Decide once, on mount, whether this device should get the full 3D treatment.
 * Anything that looks constrained — reduced-motion preference, few cores, low
 * reported memory, or a coarse pointer on a narrow screen — gets a thinner
 * particle budget rather than a janky one.
 */
export function useCapability() {
  const setLowPower = useSystem((s) => s.setLowPower);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as NavigatorWithMemory).deviceMemory ?? 8;
    const smallTouch =
      window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;

    setLowPower(reduced || cores <= 4 || mem <= 4 || smallTouch);
  }, [setLowPower]);
}
