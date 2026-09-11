"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "@/components/landing/Landing";
import CommandCenter from "@/components/hub/CommandCenter";
import { useCapability } from "@/hooks/useCapability";
import { useSystem } from "@/store/useSystem";

// The 3D scenes are the heaviest assets — never server-render them, and keep
// them out of the initial bundle so first paint is text, not WebGL. The room
// only loads once you enter the system, so the landing never pays for it.
const ParticleGlobe = dynamic(
  () => import("@/components/three/ParticleGlobe"),
  { ssr: false }
);
const CommandRoom = dynamic(() => import("@/components/three/CommandRoom"), {
  ssr: false,
});
const Aura = dynamic(() => import("@/components/aura/Aura"), { ssr: false });

export default function Home() {
  useCapability();
  const phase = useSystem((s) => s.phase);
  const inHub = phase === "hub";

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-void">
      {/* ambient ground: grid + radial bloom, pure CSS so it costs nothing */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 hud-grid opacity-[0.35]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 45%, rgb(13 148 178 / 0.18), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, rgb(167 139 250 / 0.10), transparent 70%)",
        }}
      />

      {/* The globe flies apart as you enter; the room fades up behind the hub */}
      <motion.div
        aria-hidden
        animate={{ opacity: inHub ? 0 : 1, scale: inHub ? 1.6 : 1 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none fixed inset-0"
      >
        <ParticleGlobe className="h-full w-full" />
      </motion.div>

      {inHub && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="pointer-events-none fixed inset-0"
        >
          <CommandRoom className="h-full w-full" />
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {inHub ? (
          <motion.div
            key="hub"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <CommandCenter />
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            exit={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
            transition={{ duration: 0.8, ease: [0.83, 0, 0.17, 1] }}
          >
            <Landing />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AURA only exists inside the system — the landing stays cinematic */}
      {inHub && <Aura />}
    </main>
  );
}
