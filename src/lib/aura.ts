/**
 * AURA — the on-site assistant.
 *
 * Deliberately local and rule-based: it answers only from `content/profile`,
 * so it cannot contradict the site, cannot hallucinate a publication, needs no
 * API key, and keeps the site a pure static deploy. Every reply is assembled
 * from the same typed data the panels render.
 */

import {
  identity,
  mission,
  publications,
  labProjects,
  ventures,
  experience,
  education,
  achievements,
  skillClusters,
  roadmap,
  links,
  type SectionId,
} from "@/content/profile";

export interface AuraReply {
  text: string;
  /** Module to offer opening alongside the answer. */
  section?: SectionId;
  /** Follow-up prompts to surface as chips. */
  suggestions?: string[];
}

interface Intent {
  id: string;
  keywords: string[];
  run: () => AuraReply;
}

const count = (n: number, one: string, many = one + "s") =>
  `${n} ${n === 1 ? one : many}`;

const published = publications.filter((p) => p.status === "published");
const accepted = publications.filter((p) => p.status === "accepted");
const scheduled = publications.filter((p) => p.status === "scheduled");

const INTENTS: Intent[] = [
  {
    id: "about",
    keywords: [
      "about", "who", "yourself", "bio", "introduce", "tell me about",
      "ayaan", "background", "story",
    ],
    run: () => ({
      text: `${identity.fullName} — ${identity.role}. ${mission.headline}\n\n${mission.body[0]}`,
      section: "mission",
      suggestions: ["Show research", "Show startups", "What's the long-term vision?"],
    }),
  },
  {
    id: "vision",
    keywords: ["vision", "long term", "long-term", "mission", "goal", "aim", "purpose"],
    run: () => ({
      text: mission.vision,
      section: "mission",
      suggestions: ["Show the roadmap", "Show research"],
    }),
  },
  {
    id: "research",
    keywords: [
      "research", "paper", "papers", "publication", "publications", "published",
      "ieee", "doi", "scholar", "academic", "conference",
    ],
    run: () => {
      const lead = published[0];
      return {
        text:
          `${count(publications.length, "paper")} total — ${published.length} published, ` +
          `${accepted.length} accepted, ${scheduled.length} scheduled to present.\n\n` +
          `The published one is "${lead.title}" (${lead.venue}, doi:${lead.doi}). ` +
          `The rest span swarm robotics, FPGA navigation, edge computer vision and IoT security.`,
        section: "research",
        suggestions: ["Which papers are accepted?", "Show the robotics lab", "Open Scholar"],
      };
    },
  },
  {
    id: "accepted",
    keywords: ["accepted", "in review", "upcoming paper", "not published"],
    run: () => ({
      text:
        `${count(accepted.length, "paper")} accepted and awaiting publication:\n\n` +
        accepted.map((p) => `· ${p.title}`).join("\n") +
        `\n\nPlus ${scheduled.length} scheduled for presentation at ${scheduled[0]?.venue ?? "conference"}.`,
      section: "research",
      suggestions: ["Show the published paper", "Show research directions"],
    }),
  },
  {
    id: "projects",
    keywords: [
      "project", "projects", "robot", "robotics", "lab", "drone", "uav",
      "swarm", "turtlebot", "ros", "gazebo", "simulation", "sim2real",
    ],
    run: () => ({
      text:
        `${count(labProjects.length, "system")} in the robotics lab:\n\n` +
        labProjects.map((p) => `· ${p.name} — ${p.kicker}`).join("\n"),
      section: "lab",
      suggestions: ["Tell me about the UAV twin", "Show research", "What's the stack?"],
    }),
  },
  {
    id: "startups",
    keywords: [
      "startup", "startups", "venture", "ventures", "company", "companies",
      "business", "founder", "ayrox", "formatiq", "twinverse", "vos", "forgeos",
    ],
    run: () => {
      const live = ventures.filter((v) => v.stage !== "concept");
      return {
        text:
          `${count(ventures.length, "venture")} under the AyroX Labs umbrella — ` +
          `${live.length} operating or building, ${ventures.length - live.length} at concept stage:\n\n` +
          ventures.map((v) => `· ${v.name} (${v.stage}) — ${v.tagline}`).join("\n"),
        section: "ventures",
        suggestions: ["What is TwinVerse?", "Show achievements", "Show experience"],
      };
    },
  },
  {
    id: "experience",
    keywords: [
      "experience", "work", "job", "internship", "intern", "role", "career",
      "employment", "ncai", "timeline",
    ],
    run: () => ({
      text:
        `${count(experience.length, "role")} across research labs, ventures and industry. ` +
        `Currently: ${experience
          .filter((e) => e.period.includes("Present"))
          .map((e) => `${e.title} at ${e.org}`)
          .slice(0, 3)
          .join("; ")}.`,
      section: "experience",
      suggestions: ["Where does he study?", "Show achievements", "Show startups"],
    }),
  },
  {
    id: "education",
    keywords: ["education", "study", "studies", "degree", "university", "nust", "school", "ros2 training"],
    run: () => ({
      text: education
        .map((e) => `${e.credential} — ${e.school}${e.period !== "—" ? ` (${e.period})` : ""}`)
        .join("\n"),
      section: "experience",
      suggestions: ["Show experience", "Show research"],
    }),
  },
  {
    id: "skills",
    keywords: [
      "skill", "skills", "tech", "stack", "tools", "language", "languages",
      "python", "c++", "fpga", "verilog", "capable", "know",
    ],
    run: () => ({
      text:
        `Four clusters:\n\n` +
        skillClusters
          .map((c) => `· ${c.label} — ${c.skills.slice(0, 4).map((s) => s.name).join(", ")}…`)
          .join("\n"),
      section: "skills",
      suggestions: ["Show the robotics lab", "Show research"],
    }),
  },
  {
    id: "achievements",
    keywords: [
      "achievement", "achievements", "award", "awards", "win", "won", "prize",
      "hackathon", "competition", "recognition", "alibaba",
    ],
    run: () => ({
      text: achievements.map((a) => `· ${a.title} (${a.year})`).join("\n"),
      section: "achievements",
      suggestions: ["Tell me about TwinVerse", "Show research"],
    }),
  },
  {
    id: "future",
    keywords: [
      "future", "roadmap", "next", "plan", "plans", "2027", "2028", "2030",
      "mitacs", "graduate", "phd", "masters",
    ],
    run: () => ({
      text:
        roadmap.map((r) => `${r.year} — ${r.title}: ${r.items[0]}`).join("\n"),
      section: "future",
      suggestions: ["Show research", "How do I get in touch?"],
    }),
  },
  {
    id: "contact",
    keywords: [
      "contact", "email", "reach", "hire", "touch", "linkedin", "github",
      "connect", "message", "available", "internship opportunity",
    ],
    run: () => ({
      text:
        `Email ${identity.email}.\n\nAlso on GitHub, Google Scholar, LinkedIn and ORCID — links are in the Mission Briefing module.\n\nCurrently looking for research and engineering work in autonomous systems and applied ML.`,
      section: "mission",
      suggestions: ["Show research", "Show startups"],
    }),
  },
  {
    id: "greeting",
    keywords: ["hi", "hello", "hey", "yo", "greetings", "sup"],
    run: () => ({
      text: `AURA online. I can walk you through ${identity.fullName}'s research, robotics work, ventures and record. What do you want to see?`,
      suggestions: ["Tell me about Ayaan", "Show research", "Show startups", "Show projects"],
    }),
  },
];

/**
 * Words that appear inside project names but are far too generic to identify
 * one. Without this, "show research" matches "TurtleBot3 Swarm Research" and
 * the publications intent never runs.
 */
const GENERIC = new Set([
  "research",
  "project",
  "projects",
  "system",
  "systems",
  "platform",
  "platforms",
  "robotic",
  "robotics",
  "policy",
  "transfer",
  "digital",
  "underwater",
  "manipulator",
]);

/** Specific named things get a direct answer before the generic intents run. */
function namedLookup(q: string): AuraReply | null {
  const v = ventures.find((x) => q.includes(x.name.toLowerCase()));
  if (v) {
    return {
      text: `${v.name} — ${v.tagline} (${v.stage}).\n\n${v.summary}`,
      section: "ventures",
      suggestions: ["Show all ventures", "Show achievements"],
    };
  }
  const p = labProjects.find(
    (x) =>
      q.includes(x.name.toLowerCase()) ||
      x.name
        .toLowerCase()
        .split(/[\s/]+/)
        .some((w) => w.length > 5 && !GENERIC.has(w) && q.includes(w))
  );
  if (p) {
    return {
      text: `${p.name} — ${p.kicker}.\n\n${p.summary}\n\nStack: ${p.stack.join(", ")}.`,
      section: "lab",
      suggestions: ["Show all lab systems", "Show research"],
    };
  }
  return null;
}

export function askAura(raw: string): AuraReply {
  const q = raw.toLowerCase().trim();
  if (!q) {
    return {
      text: "Ask me anything about Ayaan's research, projects, ventures or record.",
      suggestions: ["Tell me about Ayaan", "Show research", "Show startups"],
    };
  }

  const named = namedLookup(q);
  if (named) return named;

  // score each intent by how many of its keywords appear
  let best: { intent: Intent; score: number } | null = null;
  for (const intent of INTENTS) {
    let score = 0;
    for (const k of intent.keywords) {
      if (q.includes(k)) score += k.length; // longer match = stronger signal
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }

  if (best) return best.intent.run();

  return {
    text:
      "I don't have that on file. I can only answer from what's actually on this site — research, robotics systems, ventures, experience, skills, achievements and the roadmap.",
    suggestions: ["Tell me about Ayaan", "Show research", "Show projects", "How do I get in touch?"],
  };
}

export const AURA_OPENERS = [
  "Tell me about Ayaan",
  "Show research",
  "Show projects",
  "Show startups",
  "Show publications",
] as const;

export const auraLinks = links;
