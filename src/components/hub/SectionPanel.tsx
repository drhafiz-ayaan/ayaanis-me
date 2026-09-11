"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useSystem } from "@/store/useSystem";
import { cn } from "@/lib/utils";
import { sections, type SectionId } from "@/content/profile";
import {
  MissionBody,
  ResearchBody,
  LabBody,
  VenturesBody,
  ExperienceBody,
  AchievementsBody,
  SkillsBody,
  FutureBody,
} from "@/components/sections/bodies";

const BODIES: Record<SectionId, () => React.ReactElement> = {
  mission: MissionBody,
  research: ResearchBody,
  lab: LabBody,
  ventures: VenturesBody,
  experience: ExperienceBody,
  achievements: AchievementsBody,
  skills: SkillsBody,
  future: FutureBody,
};

export default function SectionPanel({ id }: { id: SectionId }) {
  const close = useSystem((s) => s.closeSection);
  const open = useSystem((s) => s.openSection);
  const panelRef = useRef<HTMLDivElement>(null);
  const meta = sections.find((s) => s.id === id)!;
  const Body = BODIES[id];

  // Escape to close, and lock the page behind the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-void/80 p-4 backdrop-blur-md sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        initial={{ opacity: 0, y: 26, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="glass my-auto w-full max-w-4xl rounded-3xl outline-none"
      >
        <header className="flex items-start justify-between gap-6 border-b border-hairline px-6 py-5 sm:px-9 sm:py-7">
          <div>
            <p className="label-hud">
              Module {meta.code} · {meta.hint}
            </p>
            <h2
              id="panel-title"
              className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl"
            >
              {meta.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close module"
            className="glass-hover shrink-0 cursor-pointer rounded-full border border-hairline p-2.5 text-ink-dim transition-colors hover:text-cyan"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        {/* Jump between modules without going back to the hub first */}
        <nav
          aria-label="Modules"
          className="flex gap-1.5 overflow-x-auto border-b border-hairline px-4 py-2.5 sm:px-7"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => open(s.id)}
              aria-current={s.id === id ? "page" : undefined}
              className={cn(
                "shrink-0 cursor-pointer rounded-full px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors sm:text-[10px]",
                s.id === id
                  ? "bg-cyan/15 text-cyan-bright"
                  : "text-ink-mute hover:text-ink-dim"
              )}
            >
              <span className="opacity-60">{s.code}</span>{" "}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-6 py-7 sm:px-9 sm:py-9">
          <Body />
        </div>
      </motion.div>
    </motion.div>
  );
}
