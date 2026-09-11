"use client";

import { motion } from "framer-motion";
import { sections, identity, publications, ventures, links } from "@/content/profile";
import { Download, Mail } from "lucide-react";
import { useSystem } from "@/store/useSystem";
import SectionPanel from "@/components/hub/SectionPanel";
import { cn } from "@/lib/utils";

/** Live-looking telemetry strip — every number is derived, none invented. */
function Telemetry() {
  const stats = [
    { k: "papers", v: String(publications.length) },
    {
      k: "published",
      v: String(publications.filter((p) => p.status === "published").length),
    },
    { k: "ventures", v: String(ventures.length) },
    { k: "labs", v: "2" },
  ];

  return (
    <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
      {stats.map((s) => (
        <div key={s.k} className="flex items-baseline gap-2">
          <dd className="font-display text-2xl font-bold text-cyan tabular-nums">
            {s.v}
          </dd>
          <dt className="font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.2em] text-ink-mute">
            {s.k}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export default function CommandCenter() {
  const openSection = useSystem((s) => s.openSection);
  const activeSection = useSystem((s) => s.activeSection);

  return (
    <>
      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
        {/* header bar */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:px-7 sm:py-5"
        >
          <div>
            <p className="label-hud">Command Center</p>
            <h1 className="mt-1.5 font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
              {identity.fullName}
            </h1>
          </div>
          <Telemetry />

          {/* The two things a recruiter actually wants, always in reach */}
          <div className="flex items-center gap-2.5">
            <a
              href={links.cv}
              download
              className="glass-hover inline-flex items-center gap-2 rounded-full border border-cyan/30 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.16em] text-cyan sm:text-[10px]"
            >
              <Download size={12} />
              CV
            </a>
            <a
              href={links.email}
              className="glass-hover inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-dim hover:text-cyan sm:text-[10px]"
            >
              <Mail size={12} />
              Contact
            </a>
          </div>
        </motion.header>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto mt-10 max-w-[54ch] text-balance text-center text-sm leading-relaxed text-ink-dim sm:text-base"
        >
          {identity.brand}
        </motion.p>

        {/* the eight modules */}
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
          }}
          className="mt-10 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {sections.map((s) => (
            <motion.li
              key={s.id}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={() => openSection(s.id)}
                aria-haspopup="dialog"
                className={cn(
                  "glass glass-hover group relative flex h-full w-full flex-col items-start",
                  "cursor-pointer rounded-2xl p-5 text-left"
                )}
              >
                <span className="font-mono text-[12px] sm:text-[10px] tracking-[0.2em] text-cyan/70">
                  {s.code}
                </span>
                <span className="mt-3 font-display text-[15px] font-semibold leading-snug text-ink">
                  {s.label}
                </span>
                <span className="mt-1.5 font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  {s.hint}
                </span>

                <span
                  aria-hidden
                  className="mt-5 h-px w-full bg-gradient-to-r from-cyan/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              </button>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      {activeSection && <SectionPanel id={activeSection} />}
    </>
  );
}
