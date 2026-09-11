"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { identity, roles, links } from "@/content/profile";
import { useSystem } from "@/store/useSystem";
import { cn } from "@/lib/utils";

const BOOT_LINES = [
  "initialising particle field",
  "resolving geometry",
  "linking research archive",
  "system ready",
];

/** Terminal-style boot readout that runs while the globe assembles. */
function BootReadout({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= BOOT_LINES.length) {
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <motion.ul
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.5 }}
      className="font-mono text-[11px] leading-relaxed tracking-[0.16em] text-ink-mute uppercase"
    >
      {BOOT_LINES.slice(0, step).map((line, i) => (
        <motion.li
          key={line}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          <span className="text-cyan">›</span>
          <span>{line}</span>
          {i === step - 1 && step < BOOT_LINES.length && (
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-cyan" />
          )}
        </motion.li>
      ))}
    </motion.ul>
  );
}

export default function Landing() {
  const phase = useSystem((s) => s.phase);
  const finishBoot = useSystem((s) => s.finishBoot);
  const enterSystem = useSystem((s) => s.enterSystem);

  const showTitle = phase === "landing";

  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <AnimatePresence mode="wait">
        {phase === "boot" && (
          <motion.div key="boot" className="absolute">
            <BootReadout onDone={finishBoot} />
          </motion.div>
        )}

        {showTitle && (
          <motion.div
            key="title"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.13, delayChildren: 0.1 } },
            }}
            className="flex flex-col items-center"
          >
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="label-hud mb-6"
            >
              {identity.location} · {identity.role}
            </motion.p>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 22, filter: "blur(10px)" },
                show: { opacity: 1, y: 0, filter: "blur(0px)" },
              }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-gradient-cyan font-display text-[clamp(2.1rem,7.5vw,5.4rem)] font-bold leading-[1.02] tracking-tight"
            >
              {identity.fullName}
            </motion.h1>

            <motion.div
              variants={{
                hidden: { opacity: 0, scaleX: 0 },
                show: { opacity: 1, scaleX: 1 },
              }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="rule-glow mt-7 h-px w-[min(30rem,80vw)]"
            />

            <motion.ul
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
              }}
              className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim sm:text-xs"
            >
              {roles.map((r, i) => (
                <motion.li
                  key={r}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-3"
                >
                  {i > 0 && <span className="text-cyan/40">/</span>}
                  <span>{r}</span>
                </motion.li>
              ))}
            </motion.ul>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="mt-8 max-w-[42ch] text-balance text-sm leading-relaxed text-ink-dim sm:text-base"
            >
              {identity.brand}
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-11 flex flex-col items-center gap-6"
            >
              <button
                type="button"
                onClick={enterSystem}
                className={cn(
                  "group relative overflow-hidden rounded-full px-9 py-3.5",
                  "glass glass-hover font-mono text-[11px] uppercase tracking-[0.28em] text-ink",
                  "cursor-pointer"
                )}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan/25 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full"
                />
                <span className="relative">Enter System</span>
              </button>

              <nav
                aria-label="External profiles"
                className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
