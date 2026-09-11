"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";
import { identity, roleModes, links } from "@/content/profile";
import { useSystem } from "@/store/useSystem";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { cn } from "@/lib/utils";
import { SEQ, DETAILS_AT, SCAN_START, SCAN_DURATION } from "@/lib/sequence";

const HeroCloud = dynamic(() => import("@/components/three/HeroCloud"), {
  ssr: false,
});

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function stageLabel(t: number) {
  if (t < SEQ.assembleEnd) return "deploying survey drone";
  if (t < SEQ.scanEnd) return "scanning subject";
  return "scan complete · uplink open";
}

/**
 * Drone telemetry panel, and the clock the whole opening runs on.
 *
 * The bar is driven off the same SEQ timings as the shader, so it cannot drift
 * from what the drone is doing — the bar finishing IS the drone departing IS
 * the details arriving. It reads elapsed time rather than counting frames, so
 * a dropped frame slows the animation without desynchronising the readout.
 */
function DroneLoader({ onReveal }: { onReveal: () => void }) {
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState(() => stageLabel(0));
  const fired = useRef(false);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      setPct(Math.round(clamp01((el - SCAN_START) / SCAN_DURATION) * 100));
      setLabel(stageLabel(el));
      if (el >= DETAILS_AT && !fired.current) {
        fired.current = true;
        onReveal();
      }
      if (el < SEQ.departEnd) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onReveal]);

  return (
    <div className="w-[min(20rem,80vw)]">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-mute sm:text-[11px]">
          <span className="text-cyan">›</span> {label}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-cyan sm:text-[11px]">
          {pct}%
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full origin-left rounded-full bg-cyan transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute/60">
        press any key to skip
      </p>
    </div>
  );
}

/** Corner brackets + a single scan sweep, drawn as the details arrive. */
function HudFrame() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span
        className="hud-bracket left-0 top-0 border-b-0 border-r-0"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="hud-bracket right-0 top-0 border-b-0 border-l-0"
        style={{ animationDelay: "90ms" }}
      />
      <span
        className="hud-bracket bottom-0 left-0 border-r-0 border-t-0"
        style={{ animationDelay: "180ms" }}
      />
      <span
        className="hud-bracket bottom-0 right-0 border-l-0 border-t-0"
        style={{ animationDelay: "270ms" }}
      />
      <span
        className="hud-sweep absolute left-0 top-0 h-px w-full opacity-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgb(34 211 238 / 0.8), transparent)",
        }}
      />
    </div>
  );
}

/**
 * The landing.
 *
 * Opens on the survey drone alone. Once it leaves frame the command-center HUD
 * draws itself and the details are revealed; the swarm then arrives and builds
 * the figure alongside them.
 */
export default function Landing() {
  const phase = useSystem((s) => s.phase);
  const finishBoot = useSystem((s) => s.finishBoot);
  const enterSystem = useSystem((s) => s.enterSystem);
  const gfxReady = useDeferredMount();
  const activeRole = useSystem((s) => s.activeRole);
  const setActiveRole = useSystem((s) => s.setActiveRole);
  const skipIntro = useSystem((s) => s.skipIntro);
  const introSkipped = useSystem((s) => s.introSkipped);

  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => {
    setRevealed(true);
    finishBoot();
  }, [finishBoot]);

  // Anyone who has asked for less motion gets the page, not the cinematic.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      skipIntro();
      setRevealed(true);
      finishBoot();
    }
  }, [skipIntro, finishBoot]);

  // Any key or pointer press ends the cinematic. A five-second opening is a
  // liability for an impatient reviewer, so it must always be escapable.
  useEffect(() => {
    if (phase !== "boot") return;
    const skip = () => {
      skipIntro();
      setRevealed(true);
      finishBoot();
    };
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [phase, skipIntro, finishBoot]);

  const revealState = introSkipped ? "instant" : revealed ? "on" : "off";

  return (
    <div className="relative z-10 min-h-dvh" data-reveal={revealState}>
      {/*
        The reconstruction. On wide screens it owns the right half beside the
        text; on narrow screens it sits behind the copy, dimmed, so it reads as
        atmosphere instead of competing with the words.
      */}
      <div className="pointer-events-none absolute inset-0 lg:left-[46%]">
        {gfxReady && (
          <SceneBoundary label="hero-cloud">
            {/*
              On narrow screens the cloud sits behind the copy and is dimmed so
              it reads as atmosphere. But during act one there is no copy to sit
              behind — dimming then would hide the entire opening — so it holds
              full strength until the details arrive.
            */}
            <HeroCloud
              className={cn(
                "h-full w-full transition-opacity duration-700 lg:opacity-100",
                revealState === "off" ? "opacity-95" : "opacity-30"
              )}
            />
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
            <DroneLoader onReveal={reveal} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center px-6 sm:px-8">
        <div className="relative w-full max-w-xl px-4 py-6">
          {revealState !== "off" && <HudFrame />}

          <div className="flex w-full flex-col items-center text-center lg:items-start lg:text-left">
            <p
              className="label-hud reveal mb-6 max-w-full text-balance"
              style={{ "--d": "180ms" } as React.CSSProperties}
            >
              {identity.location} · {identity.role}
            </p>

            {/* shortest delay of the group: this is the LCP element */}
            <h1
              className="text-gradient-cyan reveal font-display text-[clamp(2.1rem,7.5vw,4.6rem)] font-bold leading-[1.02] tracking-tight"
              style={{ "--d": "40ms" } as React.CSSProperties}
            >
              {identity.fullName}
            </h1>

            <div
              className="rule-glow reveal mt-6 h-px w-[min(26rem,80vw)]"
              style={{ "--d": "240ms" } as React.CSSProperties}
            />

            {/*
              Hovering a role drives the point cloud's behaviour, not just a
              colour: AI scatters, robotics snaps to a lattice, the twin gets
              scan bands, founder contracts. Focus works too, so it is reachable
              by keyboard; on touch, tapping holds the state.
            */}
            <ul
              className="reveal mt-6 flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1 lg:justify-start"
              style={{ "--d": "320ms" } as React.CSSProperties}
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
              {activeRole == null ? " " : roleModes[activeRole].note}
            </p>

            <p
              className="reveal mt-7 max-w-[42ch] text-balance text-sm leading-relaxed text-ink-dim sm:text-base"
              style={{ "--d": "400ms" } as React.CSSProperties}
            >
              {identity.brand}
            </p>

            <div
              className="reveal mt-10 flex flex-col items-center gap-6 lg:items-start"
              style={{ "--d": "480ms" } as React.CSSProperties}
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
    </div>
  );
}
