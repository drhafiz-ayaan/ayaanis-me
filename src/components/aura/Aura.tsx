"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Sparkles } from "lucide-react";
import { askAura, AURA_OPENERS } from "@/lib/aura";
import { useSystem } from "@/store/useSystem";
import { sections, type SectionId } from "@/content/profile";
import { cn } from "@/lib/utils";

interface Msg {
  id: number;
  from: "aura" | "user";
  text: string;
  section?: SectionId;
  suggestions?: string[];
}

let uid = 0;

export default function Aura() {
  const open = useSystem((s) => s.auraOpen);
  const setAura = useSystem((s) => s.setAura);
  const openSection = useSystem((s) => s.openSection);

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: uid++,
      from: "aura",
      text: "AURA online. I answer only from what's on this site — nothing invented. What do you want to see?",
      suggestions: [...AURA_OPENERS].slice(0, 4),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, thinking]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setAura(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setAura]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { id: uid++, from: "user", text: q }]);
    setDraft("");
    setThinking(true);

    // a beat of latency so it reads as a system responding, not a lookup table
    window.setTimeout(() => {
      const r = askAura(q);
      setMsgs((m) => [
        ...m,
        {
          id: uid++,
          from: "aura",
          text: r.text,
          section: r.section,
          suggestions: r.suggestions,
        },
      ]);
      setThinking(false);
    }, 380);
  }

  return (
    <>
      {/* launcher */}
      <motion.button
        type="button"
        onClick={() => setAura(!open)}
        aria-label={open ? "Close AURA assistant" : "Open AURA assistant"}
        aria-expanded={open}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "glass glass-hover fixed bottom-5 right-5 z-[60] flex cursor-pointer items-center gap-2.5",
          "rounded-full px-4 py-3 sm:bottom-7 sm:right-7 sm:px-5"
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink">
          {open ? "Close" : "AURA"}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="aura"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="AURA assistant"
            className={cn(
              "glass fixed bottom-20 right-3 z-[60] flex w-[calc(100vw-1.5rem)] flex-col",
              "overflow-hidden rounded-3xl sm:bottom-24 sm:right-7 sm:w-[24.5rem]",
              "max-h-[min(32rem,70dvh)]",
              // The room behind is busy — the panel needs its own ground or
              // the conversation becomes unreadable over moving wireframes.
              "bg-abyss/95 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
            )}
          >
            <header className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Sparkles size={14} className="text-cyan" />
                <div>
                  <p className="font-display text-sm font-semibold text-ink">
                    AURA
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
                    Portfolio assistant
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAura(false)}
                aria-label="Close AURA"
                className="cursor-pointer rounded-full p-1.5 text-ink-mute transition-colors hover:text-cyan"
              >
                <X size={15} />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-5 py-4"
            >
              {msgs.map((m) => (
                <div key={m.id} className="space-y-2">
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line",
                      m.from === "user"
                        ? "ml-auto bg-cyan/12 text-ink"
                        : "border border-hairline bg-midnight/50 text-ink-dim"
                    )}
                  >
                    {m.text}
                  </div>

                  {m.section && (
                    <button
                      type="button"
                      onClick={() => {
                        openSection(m.section!);
                        setAura(false);
                      }}
                      className="glass-hover cursor-pointer rounded-full border border-cyan/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan"
                    >
                      Open {sections.find((s) => s.id === m.section)?.label}
                    </button>
                  )}

                  {m.suggestions && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          className="cursor-pointer rounded-full border border-hairline px-2.5 py-1 text-[11px] text-ink-mute transition-colors hover:border-cyan/40 hover:text-cyan"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {thinking && (
                <div className="flex gap-1.5 px-1" aria-live="polite">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan/70"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-center gap-2 border-t border-hairline px-3 py-3"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about research, projects, ventures…"
                aria-label="Ask AURA"
                className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-ink outline-none placeholder:text-ink-mute"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!draft.trim()}
                className="shrink-0 cursor-pointer rounded-full border border-hairline p-2 text-ink-dim transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
