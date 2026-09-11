"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";
import { identity, roleModes, links } from "@/content/profile";
import { useSystem } from "@/store/useSystem";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { cn } from "@/lib/utils";

const HeroCloud = dynamic(() => import("@/components/three/HeroCloud"), {
  ssr: false,
});

const BOOT_LINES = [
  "initialising particle field",
  "resolving geometry",
  "reconstructing subject",
  "system ready",
];

const BOOT_STEP_MS = 300;

/**
 * Terminal-style boot readout.
 *
 * All four lines are in the DOM from the first paint and cascade in via CSS
 * animation-delay. Revealing them with JS timers made the last line paint at
 * ~4.1s, and Lighthouse picked that up as the LCP element — a decorative
 * flourish was setting the page's headline metric.
 */
function BootReadout({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, BOOT_LINES.length * BOOT_STEP_MS + 320);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <ul className="font-mono text-[12px] uppercase leading-relaxed tracking-[0.16em] text-ink-mute sm:text-[11px]">
      {BOOT_LINES.map((line, i) => (
        <li
          key={line}
          className="rise flex items-center gap-2"
          style={{ animationDelay: `${i * BOOT_STEP_MS}ms` }}
        >
          <span className="text-cyan">›</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The hero is plain markup with a CSS-driven entrance.
 *
 * Everything here is above the fold and LCP-critical, so none of it may depend
 * on hydration to become visible. Framer Motion writes its `initial` styles
 * into the SSR HTML, so an opacity-0 hero stayed invisible until hydration
 * finished — 4.5s LCP on throttled mobile. CSS animations start at first paint.
 */
export default function Landing() {
  const phase = useSystem((s) => s.phase);
  const finishBoot = useSystem((s) => s.finishBoot);
  const enterSystem = useSystem((s) => s.enterSystem);
  const gfxReady = useDeferredMount();
  const activeRole = useSystem((s) => s.activeRole);
  const setActiveRole = useSystem((s) => s.setActiveRole);

  return (
    <div className="relative z-10 min-h-dvh">
      {/*
        The reconstruction. On wide screens it owns the right half beside the
        text; on narrow screens it sits behind the copy, dimmed, so it reads as
        atmosphere instead of competing with the words.
      */}
      <div className="pointer-events-none absolute inset-0 lg:left-[46%]">
        {gfxReady && (
          <SceneBoundary label="hero-cloud">
            <HeroCloud className="h-full w-full opacity-30 lg:opacity-100" />
          </SceneBoundary>
        )}
      </div>

      <AnimatePresence>
        {phase === "boot" && (
          <motion.div
            key="boot"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 lg:left-8 lg:translate-x-0"
          >
            <BootReadout onDone={finishBoot} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center px-6 sm:px-8">
        <div className="flex w-full max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
          <p className="label-hud rise mb-6 max-w-full text-balance">
            {identity.location} · {identity.role}
          </p>

          <h1
            className="text-gradient-cyan rise font-display text-[clamp(2.1rem,7.5vw,4.6rem)] font-bold leading-[1.02] tracking-tight"
            style={{ animationDelay: "60ms" }}
          >
            {identity.fullName}
          </h1>

          <div
            className="rule-glow rise mt-6 h-px w-[min(26rem,80vw)]"
            style={{ animationDelay: "140ms" }}
          />

          {/*
            Hovering a role drives the point cloud's behaviour, not just a
            colour: AI scatters, robotics snaps to a lattice, the twin gets
            scan bands, founder contracts. Focus works too, so it is reachable
            by keyboard; on touch, tapping holds the state.
          */}
          <ul
            className="rise mt-6 flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1 lg:justify-start"
            style={{ animationDelay: "200ms" }}
            onMouseLeave={() => setActiveRole(null)}
          >
            {roleModes.map((r, i) => {
              const on = activeRole === i;
              const dim = activeRole != null && !on;
              return (
                <li key={r.label} className="flex items-center">
                  {i > 0 && (
                    <span aria-hidden className="px-1 text-cyan/30">
                      /
                    </span>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveRole(i)}
                    onFocus={() => setActiveRole(i)}
                    onBlur={() => setActiveRole(null)}
                    onClick={() => setActiveRole(on ? null : i)}
                    className={cn(
                      "cursor-pointer rounded px-1.5 py-1 font-mono text-[12px] uppercase tracking-[0.2em] transition-all duration-300 sm:text-xs",
                      dim ? "text-ink-mute/45" : "text-ink-dim"
                    )}
                    style={on ? { color: r.tint } : undefined}
                  >
                    {r.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Fixed height so revealing the note never shifts the layout */}
          <p
            aria-live="polite"
            className="mt-2 flex min-h-[1.6rem] items-center text-[13px] italic text-ink-mute transition-opacity duration-300"
            style={{ opacity: activeRole == null ? 0 : 1 }}
          >
            {activeRole == null ? " " : roleModes[activeRole].note}
          </p>

          <p
            className="rise mt-7 max-w-[42ch] text-balance text-sm leading-relaxed text-ink-dim sm:text-base"
            style={{ animationDelay: "260ms" }}
          >
            {identity.brand}
          </p>

          <div
            className="rise mt-10 flex flex-col items-center gap-6 lg:items-start"
            style={{ animationDelay: "330ms" }}
          >
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button
                type="button"
                onClick={enterSystem}
                className={cn(
                  "group relative overflow-hidden rounded-full px-9 py-3.5",
                  "glass glass-hover font-mono text-[12px] uppercase tracking-[0.28em] text-ink sm:text-[11px]",
                  "cursor-pointer"
                )}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan/25 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full"
                />
                <span className="relative">Enter System</span>
              </button>

              {/* Recruiters want the PDF, not a tour. Give them one click. */}
              <a
                href={links.cv}
                download
                className="glass-hover inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.2em] text-ink-dim hover:text-cyan sm:text-[11px]"
              >
                <Download size={13} />
                Download CV
              </a>
            </div>

            <nav
              aria-label="External profiles"
              className="flex max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-mute sm:text-[10px] lg:justify-start"
            >
              <a className="transition-colors hover:text-cyan" href={links.github}>
                GitHub
              </a>
              <a className="transition-colors hover:text-cyan" href={links.scholar}>
                Scholar
              </a>
              <a className="transition-colors hover:text-cyan" href={links.linkedin}>
                LinkedIn
              </a>
              <a className="transition-colors hover:text-cyan" href={links.email}>
                Email
              </a>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
