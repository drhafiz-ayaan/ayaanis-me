"use client";

import { create } from "zustand";
import type { SectionId } from "@/content/profile";

export type Phase = "boot" | "landing" | "hub";

interface SystemState {
  phase: Phase;
  activeSection: SectionId | null;
  auraOpen: boolean;
  /** Set once we detect a weak GPU / reduced-motion, to thin out the 3D work. */
  lowPower: boolean;

  enterSystem: () => void;
  finishBoot: () => void;
  openSection: (id: SectionId) => void;
  closeSection: () => void;
  setAura: (open: boolean) => void;
  setLowPower: (v: boolean) => void;
}

export const useSystem = create<SystemState>((set) => ({
  phase: "boot",
  activeSection: null,
  auraOpen: false,
  lowPower: false,

  finishBoot: () => set((s) => (s.phase === "boot" ? { phase: "landing" } : s)),
  enterSystem: () => set({ phase: "hub" }),
  openSection: (id) => set({ activeSection: id }),
  closeSection: () => set({ activeSection: null }),
  setAura: (open) => set({ auraOpen: open }),
  setLowPower: (v) => set({ lowPower: v }),
}));
