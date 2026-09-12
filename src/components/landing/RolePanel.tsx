"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  roleModes,
  labProjects,
  ventures,
  skillClusters,
} from "@/content/profile";

/**
 * The detail window that opens beside the figure while a role is held.
 *
 * Everything shown is looked up from the content module by id, so this panel
 * cannot say something the Robotics Lab or Startup Ecosystem modules do not.
 * It is a different view of the same records, not a second copy of them.
 */
export default function RolePanel({ index }: { index: number | null }) {
  const role = index == null ? null : roleModes[index];

  const cluster = role
    ? skillClusters.find((c) => c.id === role.detail.cluster)
    : undefined;
  const projects = role
    ? labProjects.filter((p) =>
        (role.detail.projects as readonly string[]).includes(p.id)
      )
    : [];
  const vents = role
    ? ventures.filter((v) =>
        (role.detail.ventures as readonly string[]).includes(v.id)
      )
    : [];

  return (
    <AnimatePresence mode="wait">
      {role && (
        <motion.aside
          key={role.label}
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 26 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="glass pointer-events-none w-[min(21rem,84vw)] rounded-xl p-5"
          style={{ borderColor: `${role.tint}44` }}
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: role.tint }}
            />
            <h2
              className="font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: role.tint }}
            >
              {role.label}
            </h2>
          </div>

          <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
            {role.note}
          </p>

          {(projects.length > 0 || vents.length > 0) && (
            <ul className="mt-4 space-y-2.5 border-t border-hairline pt-3.5">
              {projects.map((p) => (
                <li key={p.id}>
                  <p className="text-[13px] font-medium text-ink">{p.name}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-mute">
                    {p.stack.slice(0, 4).join(" · ")}
                  </p>
                </li>
              ))}
              {vents.map((v) => (
                <li key={v.id}>
                  <p className="text-[13px] font-medium text-ink">{v.name}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-mute">
                    {v.stage}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {cluster && (
            <div className="mt-4 border-t border-hairline pt-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
                {cluster.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cluster.skills.slice(0, 6).map((s) => (
                  <span
                    key={s.name}
                    className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-ink-dim"
                    style={{ borderColor: `${role.tint}33` }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
