"use client";

import { useState } from "react";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { ExternalLink } from "lucide-react";

// Reads a segmented PNG into a volumetric point cloud on the client — never
// server-rendered, and only loaded when the Mission module is actually opened.
const HologramAvatar = dynamic(
  () => import("@/components/three/HologramAvatar"),
  { ssr: false }
);
const LabScene = dynamic(() => import("@/components/three/LabScene"), {
  ssr: false,
});
import {
  mission,
  publications,
  researchDirections,
  labProjects,
  ventures,
  experience,
  education,
  achievements,
  skillClusters,
  roadmap,
  links,
  type PubStatus,
  type VentureStage,
} from "@/content/profile";
import { cn } from "@/lib/utils";

/* ---------------- shared primitives ---------------- */

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function List({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className="space-y-3.5"
    >
      {children}
    </motion.div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={item}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-2xl border border-hairline bg-midnight/40 p-5 sm:p-6",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

const STATUS_STYLE: Record<PubStatus, { label: string; cls: string }> = {
  published: {
    label: "Published",
    cls: "border-cyan/40 bg-cyan/10 text-cyan-bright",
  },
  accepted: {
    label: "Accepted",
    cls: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  },
  scheduled: {
    label: "Presenting Nov 2026",
    cls: "border-amber/40 bg-amber/10 text-amber",
  },
};

const STAGE_STYLE: Record<VentureStage, { label: string; cls: string }> = {
  operating: {
    label: "Operating",
    cls: "border-cyan/40 bg-cyan/10 text-cyan-bright",
  },
  building: {
    label: "Building",
    cls: "border-violet/40 bg-violet/10 text-violet",
  },
  concept: {
    label: "Concept",
    cls: "border-ink-mute/40 bg-ink-mute/10 text-ink-mute",
  },
};

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.14em]",
        className
      )}
    >
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-hairline px-2 py-0.5 font-mono text-[12px] sm:text-[10px] text-ink-dim">
      {children}
    </span>
  );
}

/* ---------------- 01 · Mission ---------------- */

export function MissionBody() {
  return (
    <div className="space-y-7">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8">
        <figure className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-b from-cyan/[0.05] to-transparent">
          {/* projector plinth glow under the cloud */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-3 h-10 rounded-[50%] bg-cyan/25 blur-2xl"
          />
          <SceneBoundary label="hologram">
            <HologramAvatar className="relative h-[21rem] w-full sm:h-[24rem]" />
          </SceneBoundary>
          <figcaption className="absolute inset-x-0 bottom-0 px-4 pb-3 text-center">
            <span className="label-hud">Subject · live reconstruction</span>
          </figcaption>
        </figure>

        <div className="space-y-4">
          <p className="font-display text-xl font-semibold leading-snug text-ink sm:text-2xl">
            {mission.headline}
          </p>
          {mission.body.map((p) => (
            <p key={p.slice(0, 24)} className="leading-relaxed text-ink-dim">
              {p}
            </p>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-5 sm:p-6">
        <p className="label-hud mb-2">Long-term vision</p>
        <p className="leading-relaxed text-ink">{mission.vision}</p>
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        {[
          ["GitHub", links.github],
          ["Google Scholar", links.scholar],
          ["LinkedIn", links.linkedin],
          ["ORCID", links.orcid],
        ].map(([label, href]) => (
          <a
            key={label}
            href={href}
            className="glass-hover inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-1.5 font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.16em] text-ink-dim hover:text-cyan"
          >
            {label}
            <ExternalLink size={11} />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 02 · Research ---------------- */

export function ResearchBody() {
  return (
    <div className="space-y-8">
      <List>
        {publications.map((p, i) => {
          const s = STATUS_STYLE[p.status];
          return (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[12px] sm:text-[10px] tracking-[0.2em] text-cyan/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Chip className={s.cls}>{s.label}</Chip>
                <span className="font-mono text-[12px] sm:text-[10px] text-ink-mute">
                  {p.domain}
                </span>
              </div>

              <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink sm:text-lg">
                {p.title}
              </h3>

              {p.venue && (
                <p className="mt-1.5 text-xs italic text-ink-mute">
                  {p.venue} · {p.year}
                  {p.pages ? ` · ${p.pages}` : ""}
                </p>
              )}
              {p.authors && (
                <p className="mt-1 text-xs text-ink-mute">{p.authors}</p>
              )}

              <p className="mt-3 text-sm leading-relaxed text-ink-dim">
                {p.summary}
              </p>

              <ul className="mt-3.5 space-y-1.5">
                {p.contributions.map((c) => (
                  <li
                    key={c}
                    className="flex gap-2.5 text-sm text-ink-dim before:mt-[0.6em] before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-cyan/60"
                  >
                    {c}
                  </li>
                ))}
              </ul>

              {p.doiUrl && (
                <a
                  href={p.doiUrl}
                  className="mt-4 inline-flex items-center gap-1.5 font-mono text-[12px] sm:text-[11px] text-cyan transition-opacity hover:opacity-75"
                >
                  doi:{p.doi}
                  <ExternalLink size={11} />
                </a>
              )}
            </Card>
          );
        })}
      </List>

      <div>
        <p className="label-hud mb-4">Active research directions</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {researchDirections.map((d) => (
            <div
              key={d.title}
              className="rounded-xl border border-hairline bg-midnight/30 p-4"
            >
              <h4 className="font-display text-sm font-semibold text-ink">
                {d.title}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">
                {d.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 03 · Robotics Lab ---------------- */

const LAB_VIEWS = [
  {
    id: "swarm" as const,
    label: "Swarm formation",
    caption:
      "Five units holding a V with no central coordinator. The links are drawn from live positions — each unit corrects against its neighbours, so the formation survives losing any of them.",
  },
  {
    id: "uav" as const,
    label: "UAV digital twin",
    caption:
      "Orbit pass with the LiDAR building the ground map underneath. Points resolve as the aircraft sweeps over them — the twin assembling from flight, not from a prior model.",
  },
];

export function LabBody() {
  const [view, setView] = useState<"swarm" | "uav">("swarm");
  const active = LAB_VIEWS.find((v) => v.id === view)!;

  return (
    <div className="space-y-8">
      {/* live viewport */}
      <figure className="overflow-hidden rounded-2xl border border-hairline bg-midnight/40">
        <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2.5">
          {LAB_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.14em] transition-colors sm:text-[10px]",
                view === v.id
                  ? "bg-cyan/15 text-cyan-bright"
                  : "text-ink-mute hover:text-ink-dim"
              )}
            >
              {v.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 pr-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
            <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-mute sm:text-[10px]">
              Live
            </span>
          </span>
        </div>

        <SceneBoundary label={`lab-${view}`}>
          {/* key remounts the canvas so each scene starts from t=0 */}
          <LabScene key={view} mode={view} className="h-[17rem] w-full sm:h-[21rem]" />
        </SceneBoundary>

        <figcaption className="border-t border-hairline px-4 py-3 text-xs leading-relaxed text-ink-mute">
          {active.caption}
        </figcaption>
      </figure>

      <List>
      {labProjects.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              {p.name}
            </h3>
            <span className="font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.14em] text-cyan/80">
              {p.kicker}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ink-dim">{p.summary}</p>

          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {p.capabilities.map((c) => (
              <li
                key={c}
                className="flex gap-2.5 text-sm text-ink-dim before:mt-[0.6em] before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-cyan/60"
              >
                {c}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {p.stack.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {p.repo && (
              <a
                href={p.repo}
                className="ml-1 inline-flex items-center gap-1.5 font-mono text-[12px] sm:text-[10px] text-cyan hover:opacity-75"
              >
                repository
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </Card>
      ))}
      </List>
    </div>
  );
}

/* ---------------- 04 · Ventures ---------------- */

const ACCENT_RING: Record<string, string> = {
  cyan: "from-cyan/25",
  ice: "from-ice/25",
  violet: "from-violet/25",
  amber: "from-amber/25",
};

export function VenturesBody() {
  return (
    <List>
      {ventures.map((v) => {
        const s = STAGE_STYLE[v.stage];
        return (
          <Card key={v.id} className="relative overflow-hidden">
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br to-transparent blur-2xl",
                ACCENT_RING[v.accent]
              )}
            />
            <div className="relative flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-lg font-semibold text-ink">
                {v.name}
              </h3>
              <Chip className={s.cls}>{s.label}</Chip>
            </div>
            <p className="relative mt-1 font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              {v.tagline}
            </p>
            <p className="relative mt-3 text-sm leading-relaxed text-ink-dim">
              {v.summary}
            </p>
            <div className="relative mt-4 flex flex-wrap gap-1.5">
              {v.focus.map((f) => (
                <Tag key={f}>{f}</Tag>
              ))}
            </div>
          </Card>
        );
      })}
    </List>
  );
}

/* ---------------- 05 · Experience ---------------- */

const KIND_DOT: Record<string, string> = {
  research: "bg-cyan",
  founder: "bg-violet",
  industry: "bg-ice",
};

export function ExperienceBody() {
  return (
    <div className="space-y-8">
      <div className="relative">
        <div
          aria-hidden
          className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-cyan/50 via-hairline to-transparent"
        />
        <motion.ol
          initial="hidden"
          animate="show"
          variants={stagger}
          className="space-y-6"
        >
          {experience.map((r) => (
            <motion.li
              key={`${r.org}-${r.title}`}
              variants={item}
              transition={{ duration: 0.5 }}
              className="relative pl-7"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-void",
                  KIND_DOT[r.kind]
                )}
              />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-display text-base font-semibold text-ink">
                  {r.title}
                </h3>
                <span className="font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.16em] text-cyan/80">
                  {r.period}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink-dim">
                {r.org} · <span className="text-ink-mute">{r.location}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-mute">
                {r.detail}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </div>

      <div>
        <p className="label-hud mb-4">Education</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {education.map((e) => (
            <div
              key={e.credential}
              className="rounded-xl border border-hairline bg-midnight/30 p-4"
            >
              <h4 className="font-display text-sm font-semibold text-ink">
                {e.credential}
              </h4>
              <p className="mt-1 text-xs text-ink-dim">{e.school}</p>
              <p className="mt-1 font-mono text-[12px] sm:text-[10px] text-cyan/70">
                {e.period}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                {e.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 06 · Achievements ---------------- */

const TIER: Record<string, string> = {
  gold: "border-amber/45 bg-amber/[0.07]",
  silver: "border-ice/35 bg-ice/[0.05]",
  bronze: "border-hairline bg-midnight/30",
};

export function AchievementsBody() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className="grid gap-3 sm:grid-cols-2"
    >
      {achievements.map((a) => (
        <motion.div
          key={a.title}
          variants={item}
          transition={{ duration: 0.5 }}
          className={cn("rounded-2xl border p-5", TIER[a.tier])}
        >
          <p className="font-mono text-[12px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            {a.year}
          </p>
          <h3 className="mt-2 font-display text-sm font-semibold leading-snug text-ink">
            {a.title}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
            {a.detail}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ---------------- 07 · Skills ---------------- */

const ACCENT_BAR: Record<string, string> = {
  cyan: "bg-cyan",
  ice: "bg-ice",
  violet: "bg-violet",
  amber: "bg-amber",
};

export function SkillsBody() {
  return (
    <div className="space-y-8">
      {skillClusters.map((c) => (
        <div key={c.id}>
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden
              className={cn("h-2 w-2 rounded-full", ACCENT_BAR[c.accent])}
            />
            <p className="label-hud">{c.label}</p>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            variants={stagger}
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
          >
            {c.skills.map((s) => (
              <motion.div
                key={s.name}
                variants={item}
                transition={{ duration: 0.45 }}
                className="rounded-xl border border-hairline bg-midnight/30 p-3.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink">
                    {s.name}
                  </span>
                  <span className="font-mono text-[12px] sm:text-[10px] tabular-nums text-ink-mute">
                    {s.level}
                  </span>
                </div>
                {/* radial-free capability read: a thin saturation bar */}
                <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-hairline">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: s.level / 100 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "h-full origin-left rounded-full",
                      ACCENT_BAR[c.accent]
                    )}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}
      <p className="text-xs italic text-ink-mute">
        Levels are self-assessed, not benchmarked — they describe relative depth
        across my own stack.
      </p>
    </div>
  );
}

/* ---------------- 08 · Future ---------------- */

export function FutureBody() {
  return (
    <motion.ol
      initial="hidden"
      animate="show"
      variants={stagger}
      className="relative space-y-5"
    >
      {roadmap.map((r, i) => (
        <motion.li
          key={r.year}
          variants={item}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl border border-hairline bg-midnight/30 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-2xl font-bold text-cyan tabular-nums">
              {r.year}
            </span>
            <h3 className="font-display text-base font-semibold text-ink">
              {r.title}
            </h3>
          </div>
          <ul className="mt-3.5 space-y-1.5">
            {r.items.map((it) => (
              <li
                key={it}
                className="flex gap-2.5 text-sm text-ink-dim before:mt-[0.6em] before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-cyan/60"
              >
                {it}
              </li>
            ))}
          </ul>
          {i < roadmap.length - 1 && (
            <span
              aria-hidden
              className="absolute -bottom-5 left-8 h-5 w-px bg-gradient-to-b from-cyan/40 to-transparent"
            />
          )}
        </motion.li>
      ))}
    </motion.ol>
  );
}
