/**
 * Single source of truth for every fact on this site.
 *
 * Sourced from Ayaan's Europass CV (Sept 2026) and the portfolio brief.
 * Publication `status` is deliberately explicit: only the ACDSA paper is
 * actually published with a DOI — the rest are accepted or scheduled, and
 * the UI must never render them as published. Ventures carry a `stage` for
 * the same reason, so concept-stage work reads as concept-stage.
 */

export const identity = {
  fullName: "Ayaan Aatif",
  shortName: "Ayaan",
  handle: "drhafiz-ayaan",
  role: "Electrical Engineering Student · NUST SEECS",
  brand:
    "Building the Future Through AI, Robotics, Digital Twins and Intelligent Systems",
  identityLine: "Researcher · Builder · Founder · Engineer",
  location: "Islamabad, Pakistan",
  email: "drhafiz.ayaan@gmail.com",
  domain: "ayaanaatif.me",
} as const;

/**
 * The four roles, each with an accent and a behaviour for the hero point
 * cloud. Hovering a role should *show* what it means rather than just
 * recolour the page — so `mode` selects a displacement in the cloud shader.
 */
/**
 * The four hats, and what each one pulls up on the landing.
 *
 * `detail` holds ids rather than prose so the hover panel renders the same
 * project and skill records the rest of the site does. Restating them here as
 * copy would let the landing drift out of step with the modules, and would
 * mean a second, unverified description of work that is already described.
 */
export const roleModes = [
  {
    label: "AI Engineer",
    tint: "#a78bfa",
    note: "perception, learning, inference at the edge",
    /** 0 — high-frequency jitter: a field still searching for its answer */
    mode: 0,
    detail: {
      cluster: "ai",
      projects: ["sim2real", "turtlebot-swarm"],
      ventures: [],
    },
  },
  {
    label: "Robotics Researcher",
    tint: "#22d3ee",
    note: "autonomy that has to survive the real world",
    /** 1 — snaps to a lattice: mechanical, discretised, repeatable */
    mode: 1,
    detail: {
      cluster: "robotics",
      projects: ["turtlebot-swarm", "uav-twin", "underwater-arm"],
      ventures: [],
    },
  },
  {
    label: "Digital Twin Builder",
    tint: "#7dd3fc",
    note: "the physical world, mirrored and synchronised",
    /** 2 — horizontal scan bands sweep the body, the twin refreshing */
    mode: 2,
    detail: {
      cluster: "engineering",
      projects: ["uav-twin"],
      ventures: ["twinverse"],
    },
  },
  {
    label: "Founder",
    tint: "#fbbf24",
    note: "research turned into something people can deploy",
    /** 3 — contracts and brightens: scattered work pulled into one thing */
    mode: 3,
    detail: {
      cluster: "development",
      projects: [],
      ventures: ["ayrox", "twinverse", "formatiq"],
    },
  },
] as const;

export const roles = roleModes.map((r) => r.label);

export const links = {
  github: "https://github.com/drhafiz-ayaan",
  linkedin: "https://www.linkedin.com/in/ayaan-aatif-867a3128b",
  scholar: "https://scholar.google.com/citations?user=ABC3PioAAAAJ&hl=en",
  orcid: "https://orcid.org/0009-0000-5548-8187",
  email: "mailto:drhafiz.ayaan@gmail.com",
  cv: "/Ayaan-Aatif-CV.pdf",
} as const;

/* ------------------------------------------------------------------ */
/* MISSION                                                             */
/* ------------------------------------------------------------------ */

export const mission = {
  headline: "Machines that perceive, decide and move on their own.",
  body: [
    "I work where robotics, embedded hardware and machine learning collapse into a single stack — autonomous navigation running on FPGA, digital twins that stay synchronised with the physical world, and perception models small enough to survive at the edge.",
    "At Pakistan's National Center of Artificial Intelligence I sit in the AI & Computer Vision group, working on neural rendering and Gaussian splatting, and on digital-twin systems for autonomous platforms. Alongside that I run AyroX Labs, turning that research into drones, inspection systems and twin infrastructure that people can actually deploy.",
    "Six papers across swarm robotics, FPGA navigation, edge computer vision and IoT security. Two research labs, three ventures, one regional hackathon win. I am looking for research and engineering work in autonomous systems and applied machine learning.",
  ],
  vision:
    "To build the intelligence layer for physical infrastructure — systems that model the real world, reason about it, and act inside it.",
} as const;

/* ------------------------------------------------------------------ */
/* RESEARCH                                                            */
/* ------------------------------------------------------------------ */

export type PubStatus = "published" | "accepted" | "scheduled";

export interface Publication {
  id: string;
  title: string;
  status: PubStatus;
  venue?: string;
  year: string;
  authors?: string;
  doi?: string;
  doiUrl?: string;
  pages?: string;
  domain: string;
  summary: string;
  contributions: string[];
}

export const publications: Publication[] = [
  {
    id: "nocs",
    title:
      "Fault-Tolerant Adaptive Routing in NoCs: Machine Learning Approaches for Resilient On-Chip Networks",
    status: "published",
    venue:
      "IEEE ACDSA 2025 — International Conference on Artificial Intelligence, Computer, Data Sciences and Applications",
    year: "2025",
    authors:
      "M. Adnan, M. A. Chaudary, M. M. Ali, H. A. Aatif, M. I. Raza, H. A. Ramzan",
    doi: "10.1109/ACDSA65407.2025.11165816",
    doiUrl: "https://doi.org/10.1109/ACDSA65407.2025.11165816",
    pages: "pp. 1–7",
    domain: "On-Chip Networks · Machine Learning",
    summary:
      "Routing on a network-on-chip has to keep working when links degrade. This work applies learned routing policies so the fabric adapts around faults instead of failing around them.",
    contributions: [
      "Learned adaptive routing that tolerates link and node faults",
      "Evaluated against conventional deterministic routing under induced failures",
      "Presented at ACDSA 2025, Antalya, Türkiye",
    ],
  },
  {
    id: "hil-fpga",
    title:
      "A Hardware-in-the-Loop Multi-Sensor Fusion Framework for Low-Latency Autonomous Navigation on FPGA-Based Mobile Robots",
    status: "accepted",
    venue: "IEEE Conference",
    year: "2026",
    domain: "FPGA · Sensor Fusion · Navigation",
    summary:
      "Sensor fusion moved onto reconfigurable hardware, closing the perception-to-motion loop inside the FPGA fabric rather than across a software stack.",
    contributions: [
      "Hardware-in-the-loop validation rig for navigation stacks",
      "Multi-sensor fusion pipeline synthesised to FPGA",
      "Latency characterised against a CPU-bound baseline",
    ],
  },
  {
    id: "scope",
    title:
      "Decentralized Formation Control of Miniature Robots using the SCOPE Strategy",
    status: "accepted",
    year: "2026",
    domain: "Swarm Robotics · Distributed Control",
    summary:
      "Formation control with no central coordinator — each robot holds formation from local observation alone, so the swarm degrades gracefully as members drop out.",
    contributions: [
      "SCOPE strategy for decentralised formation keeping",
      "Validated on miniature ground robots",
      "Scales without a central planner or global state",
    ],
  },
  {
    id: "zeroday",
    title:
      "Robust Zero-Day Intrusion Prevention in IoT Networks Using Hybrid Machine Learning",
    status: "accepted",
    year: "2026",
    domain: "IoT Security · Hybrid ML",
    summary:
      "Detecting attacks that have no signature yet, on hardware that cannot afford a heavyweight model.",
    contributions: [
      "Hybrid detector combining signature and anomaly approaches",
      "Targeted at constrained IoT deployments",
      "Evaluated against unseen attack classes",
    ],
  },
  {
    id: "lard",
    title:
      "LARD: Lightweight Attention-Augmented Real-Time Detection for Occlusion-Robust Pedestrian Recognition on Edge Hardware",
    status: "accepted",
    year: "2026",
    domain: "Computer Vision · Edge Inference",
    summary:
      "Attention applied only where it pays for itself, so pedestrians stay detected through occlusion while the model still runs at edge latency.",
    contributions: [
      "Lightweight attention module for occlusion robustness",
      "Real-time throughput on edge hardware",
      "Benchmarked on occluded pedestrian scenarios",
    ],
  },
  {
    id: "iot-nids",
    title:
      "Machine Learning Approaches for Network Intrusion Detection in IoT Environments",
    status: "scheduled",
    venue: "GIKI International Conference",
    year: "2026",
    domain: "IoT Security · Intrusion Detection",
    summary:
      "Accepted, with the presentation scheduled for November 2026.",
    contributions: [
      "Comparative study of ML approaches for IoT intrusion detection",
      "Presentation scheduled November 2026",
    ],
  },
];

export const researchDirections = [
  {
    title: "Neural Rendering & Gaussian Splatting",
    detail:
      "Reconstructing scenes as differentiable radiance fields for AI-enhanced imaging — current work in the NCAI AI & Computer Vision group.",
  },
  {
    title: "Digital Twin Synchronisation",
    detail:
      "Keeping a virtual model locked to a physical platform in real time: semantic mapping, state sync and predictive analytics.",
  },
  {
    title: "FPGA Sensor Evaluation",
    detail:
      "Characterising sensor pipelines on reconfigurable hardware where latency budgets are measured in microseconds.",
  },
  {
    title: "RF, Antennas & EMC",
    detail:
      "Integrating antenna subsystems into robotic platforms and validating them under electromagnetic compatibility testing.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* ROBOTICS LAB                                                        */
/* ------------------------------------------------------------------ */

export interface LabProject {
  id: string;
  name: string;
  kicker: string;
  summary: string;
  capabilities: string[];
  stack: string[];
  repo?: string;
}

export const labProjects: LabProject[] = [
  {
    id: "turtlebot-swarm",
    name: "TurtleBot3 Swarm Research",
    kicker: "Decentralised formation · Autonomous navigation",
    summary:
      "A ground-robot swarm holding formation without a central coordinator, navigating and avoiding obstacles from local observation alone. The experimental basis for the SCOPE formation work.",
    capabilities: [
      "Decentralised formation keeping",
      "Autonomous navigation and path planning",
      "Obstacle avoidance",
      "Multi-agent coordination",
    ],
    stack: ["ROS2", "Gazebo", "RViz", "Nav2", "Python"],
  },
  {
    id: "uav-twin",
    name: "UAV Digital Twin Platform",
    kicker: "PX4 · LiDAR · Twin mapping",
    summary:
      "A flight platform mirrored by a live digital twin — LiDAR mapping feeding a synchronised virtual environment used for inspection planning and simulation-first development.",
    capabilities: [
      "PX4 flight stack integration",
      "LiDAR mapping and point-cloud processing",
      "Real-time twin synchronisation",
      "Simulation-first mission rehearsal",
    ],
    stack: ["PX4", "ROS2", "LiDAR", "Gazebo", "Python"],
  },
  {
    id: "underwater-arm",
    name: "Underwater Robotic Manipulator",
    kicker: "Aerial Robotics Laboratory",
    summary:
      "Manipulator integration and autonomous control for submerged operation — kinematics, actuation and perception where the medium fights every assumption.",
    capabilities: [
      "Manipulator kinematics and control",
      "Actuation for submerged operation",
      "Perception under water",
    ],
    stack: ["ROS2", "Python", "Control"],
    repo: "https://github.com/drhafiz-ayaan/underwater-robotic-arm",
  },
  {
    id: "sim2real",
    name: "Sim2Real Policy Transfer",
    kicker: "Reinforcement learning · Deployment",
    summary:
      "A ROS2 pipeline that takes policies learned in simulation and deploys them onto real hardware, closing the gap that usually kills simulator-trained behaviour.",
    capabilities: [
      "Reinforcement learning in simulation",
      "Domain randomisation",
      "Policy deployment to physical robots",
    ],
    stack: ["ROS2", "Gazebo", "PyTorch", "Python"],
  },
];

/* ------------------------------------------------------------------ */
/* VENTURES — the AyroX Labs galaxy                                    */
/* ------------------------------------------------------------------ */

export type VentureStage = "operating" | "building" | "concept";

export interface Venture {
  id: string;
  name: string;
  tagline: string;
  stage: VentureStage;
  summary: string;
  focus: string[];
  accent: "cyan" | "ice" | "violet" | "amber";
}

export const ventures: Venture[] = [
  {
    id: "ayrox",
    name: "AyroX Labs",
    tagline: "The parent system",
    stage: "operating",
    summary:
      "A robotics venture building intelligent drones, digital twins and AI-enabled inspection systems. Founded 2024; I lead research-to-product across robotics, AI and cyber-physical systems.",
    focus: [
      "Intelligent drones",
      "Digital twin infrastructure",
      "AI inspection systems",
      "Research-to-product",
    ],
    accent: "cyan",
  },
  {
    id: "formatiq",
    name: "FormatIQ",
    tagline: "Research automation",
    stage: "operating",
    summary:
      "A platform that takes the formatting work out of academic writing — reports, assignments, theses and IEEE papers. I own product direction, architecture and delivery.",
    focus: ["Reports", "Assignments", "Thesis formatting", "IEEE papers"],
    accent: "ice",
  },
  {
    id: "twinverse",
    name: "TwinVerse",
    tagline: "Digital twin intelligence",
    stage: "building",
    summary:
      "Infrastructure inspection that fuses drone, CCTV, robotic and smartphone feeds into one pipeline — defect detection, severity scoring, predictive maintenance and live twin visualisation. Regional winner, Alibaba Cloud AI Hackathon.",
    focus: [
      "Infrastructure monitoring",
      "Asset intelligence",
      "Predictive maintenance",
      "Twin visualisation",
    ],
    accent: "violet",
  },
  {
    id: "vos",
    name: "VOS Labs",
    tagline: "Vision operating system",
    stage: "concept",
    summary:
      "A vision layer for machines that need to understand a scene, not just see it — camera intelligence and real-time scene understanding as a reusable substrate.",
    focus: [
      "Camera intelligence",
      "AI perception",
      "Real-time scene understanding",
    ],
    accent: "cyan",
  },
  {
    id: "forgeos",
    name: "ForgeOS",
    tagline: "Intelligent OS concepts",
    stage: "concept",
    summary:
      "Early exploration of what an operating system looks like when intelligence is a primitive rather than an application.",
    focus: ["Systems research", "Intelligent runtime", "Exploratory"],
    accent: "amber",
  },
];

/* ------------------------------------------------------------------ */
/* EXPERIENCE                                                          */
/* ------------------------------------------------------------------ */

export interface Role {
  org: string;
  title: string;
  period: string;
  location: string;
  detail: string;
  kind: "research" | "founder" | "industry";
}

export const experience: Role[] = [
  {
    org: "National Center of Artificial Intelligence (NCAI)",
    title: "Research Assistant",
    period: "2026 — Present",
    location: "Pakistan",
    kind: "research",
    detail:
      "Neural rendering and AI image enhancement using Gaussian splatting in the AI & Computer Vision group. Building digital-twin systems for autonomous platforms: real-time physical-virtual synchronisation, semantic mapping and predictive analytics.",
  },
  {
    org: "RF Antenna & Electromagnetic Compatibility Testing Laboratory",
    title: "Research Collaborator",
    period: "2026 — Present",
    location: "Pakistan",
    kind: "research",
    detail:
      "Integrating RF antenna subsystems into robotic platforms and supporting EMC testing for digital-twin-enabled communication systems.",
  },
  {
    org: "FormatIQ",
    title: "Founder",
    period: "2026 — Present",
    location: "Pakistan",
    kind: "founder",
    detail:
      "Built a research automation platform streamlining academic formatting for reports, theses, CVs and IEEE papers. Own product direction, architecture and delivery.",
  },
  {
    org: "Brain Swarm Robotics",
    title: "Robotics Intern",
    period: "2026",
    location: "Pakistan",
    kind: "industry",
    detail:
      "Developed navigation, perception and simulation workflows for a warehouse automation robot.",
  },
  {
    org: "Aerial Robotics Laboratory",
    title: "Robotics Intern",
    period: "2026",
    location: "Pakistan",
    kind: "research",
    detail:
      "Contributed to underwater robotic manipulator integration and autonomous robot development.",
  },
  {
    org: "International Research Collaboration",
    title: "Contract Research Assistant",
    period: "2025 — 2026",
    location: "Türkiye (remote)",
    kind: "research",
    detail:
      "Supported development of an autonomous inspection drone platform for solar farm monitoring.",
  },
  {
    org: "AyroX Labs",
    title: "Founder & Technical Lead",
    period: "2024 — Present",
    location: "Pakistan",
    kind: "founder",
    detail:
      "Founded a robotics venture building intelligent drones, digital twins and AI-enabled inspection systems. Lead research-to-product development across robotics, AI and cyber-physical systems.",
  },
  {
    org: "Scentimental",
    title: "Founder",
    period: "Ongoing",
    location: "Pakistan",
    kind: "founder",
    detail:
      "Launched and grew an independent perfume brand, securing multiple sponsorships including recognition within NUST.",
  },
  {
    org: "Fiverr",
    title: "Freelance Engineer — Level 2 Seller",
    period: "2021 — Present",
    location: "Remote",
    kind: "industry",
    detail:
      "Deliver robotics, AI, embedded systems and software development projects for international clients. Maintain a 5-star rating.",
  },
];

export const education = [
  {
    school: "National University of Sciences and Technology (NUST)",
    credential: "BE Electrical Engineering",
    period: "2024 — 2028 (expected)",
    detail: "Focus areas: robotics, embedded systems and artificial intelligence.",
  },
  {
    school: "Professional Certification",
    credential: "ROS2 Professional Training Program",
    period: "—",
    detail: "Production ROS2 development and deployment.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* ACHIEVEMENTS                                                        */
/* ------------------------------------------------------------------ */

export const achievements = [
  {
    title: "Regional Winner — Alibaba Cloud AI Hackathon",
    detail: "For TwinVerse Inspect AI, an AI infrastructure-inspection platform.",
    year: "2026",
    tier: "gold" as const,
  },
  {
    title: "Published — IEEE ACDSA 2025",
    detail:
      "Fault-Tolerant Adaptive Routing in NoCs, Antalya, Türkiye. DOI 10.1109/ACDSA65407.2025.11165816",
    year: "2025",
    tier: "gold" as const,
  },
  {
    title: "Five papers accepted",
    detail:
      "Across swarm robotics, FPGA navigation, edge computer vision and IoT security.",
    year: "2026",
    tier: "silver" as const,
  },
  {
    title: "Presenter — GIKI International Conference",
    detail: "Presentation scheduled November 2026.",
    year: "2026",
    tier: "silver" as const,
  },
  {
    title: "Fiverr Level 2 Seller",
    detail: "5-star rating delivering robotics and AI work internationally.",
    year: "2021 — Present",
    tier: "bronze" as const,
  },
  {
    title: "Participant — Indus Ras Expo Engineering Competition",
    detail: "Engineering competition.",
    year: "2026",
    tier: "bronze" as const,
  },
] as const;

/* ------------------------------------------------------------------ */
/* SKILLS                                                              */
/* ------------------------------------------------------------------ */

export interface SkillNode {
  name: string;
  level: number; // 0–100, self-assessed
}

export interface SkillCluster {
  id: string;
  label: string;
  accent: "cyan" | "ice" | "violet" | "amber";
  skills: SkillNode[];
}

export const skillClusters: SkillCluster[] = [
  {
    id: "robotics",
    label: "Robotics & Autonomy",
    accent: "cyan",
    skills: [
      { name: "ROS2", level: 92 },
      { name: "Gazebo", level: 89 },
      { name: "Nav2", level: 85 },
      { name: "RViz", level: 84 },
      { name: "MoveIt", level: 72 },
      { name: "PX4", level: 76 },
      { name: "SLAM", level: 82 },
      { name: "Sim2Real", level: 80 },
    ],
  },
  {
    id: "ai",
    label: "AI & Perception",
    accent: "violet",
    skills: [
      { name: "Computer Vision", level: 88 },
      { name: "Deep Learning", level: 84 },
      { name: "PyTorch", level: 82 },
      { name: "TensorFlow", level: 78 },
      { name: "scikit-learn", level: 83 },
      { name: "Gaussian Splatting", level: 74 },
      { name: "CLIP", level: 70 },
    ],
  },
  {
    id: "engineering",
    label: "Embedded & Hardware",
    accent: "ice",
    skills: [
      { name: "ESP32", level: 88 },
      { name: "STM32", level: 80 },
      { name: "Arduino", level: 90 },
      { name: "FPGA / Verilog", level: 76 },
      { name: "UART / SPI / I2C", level: 87 },
      { name: "PCB Design", level: 72 },
      { name: "Control Systems", level: 79 },
      { name: "Hardware-in-the-Loop", level: 78 },
    ],
  },
  {
    id: "development",
    label: "Software & Tools",
    accent: "amber",
    skills: [
      { name: "Python", level: 94 },
      { name: "C / C++", level: 85 },
      { name: "Linux", level: 86 },
      { name: "Git", level: 88 },
      { name: "Java", level: 68 },
      { name: "JavaScript", level: 66 },
      { name: "PostgreSQL", level: 64 },
      { name: "SolidWorks", level: 75 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* ROADMAP                                                             */
/* ------------------------------------------------------------------ */

export const roadmap = [
  {
    year: "2026",
    title: "Research Depth",
    items: [
      "Present at GIKI International Conference",
      "Push accepted papers through to publication",
      "Scale TwinVerse beyond the hackathon prototype",
    ],
  },
  {
    year: "2027",
    title: "International Research",
    items: [
      "MITACS Globalink research placement",
      "International lab collaboration",
      "First-author work in autonomous systems",
    ],
  },
  {
    year: "2028",
    title: "Graduate Studies",
    items: [
      "Complete BE Electrical Engineering at NUST",
      "Graduate admission in robotics or AI systems",
      "AyroX Labs operating independently",
    ],
  },
  {
    year: "2030+",
    title: "Systems at Scale",
    items: [
      "Robotics research lab of my own",
      "AI infrastructure systems in production",
      "A startup ecosystem that outlives any one product",
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* NAVIGATION                                                          */
/* ------------------------------------------------------------------ */

export const sections = [
  { id: "mission", label: "Mission Briefing", code: "01", hint: "Who I am" },
  { id: "research", label: "Research Archive", code: "02", hint: "6 papers" },
  { id: "lab", label: "Robotics Lab", code: "03", hint: "Field systems" },
  { id: "ventures", label: "Startup Ecosystem", code: "04", hint: "AyroX galaxy" },
  { id: "experience", label: "Experience Center", code: "05", hint: "Timeline" },
  { id: "achievements", label: "Achievement Vault", code: "06", hint: "Record" },
  { id: "skills", label: "Skills Matrix", code: "07", hint: "Capability map" },
  { id: "future", label: "Future Vision", code: "08", hint: "2026 → 2030+" },
] as const;

export type SectionId = (typeof sections)[number]["id"];
