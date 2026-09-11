"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "@/components/landing/Landing";
import CommandCenter from "@/components/hub/CommandCenter";
import { useCapability } from "@/hooks/useCapability";
import { useSystem } from "@/store/useSystem";

// The 3D backdrop is the single heaviest asset — never server-render it, and
// keep it out of the initial bundle so first paint is text, not WebGL.
const ParticleGlobe = dynamic(
  () => import("@/components/three/ParticleGlobe"),
  { ssr: false }
);

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

      {/* The globe recedes and dims once you're inside the system */}
      <motion.div
        aria-hidden
        animate={{
          opacity: inHub ? 0.32 : 1,
          scale: inHub ? 1.35 : 1,
        }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none fixed inset-0"
      >
        <ParticleGlobe className="h-full w-full" />
      </motion.div>

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
    </main>
  );
}
