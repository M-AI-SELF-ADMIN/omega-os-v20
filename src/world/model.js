export const ZONES = {
  forge:  { label: "Code Forge",   col: "#E8530E", x: 40,  y: 30,  w: 120, h: 80, ic: "⚒",  mem: [0, 1, 8] },
  vault:  { label: "Memory Vault", col: "#2196F3", x: 220, y: 30,  w: 100, h: 80, ic: "🧠", mem: [0, 1, 2, 3, 4] },
  lab:    { label: "Research Lab", col: "#8BC34A", x: 380, y: 30,  w: 110, h: 80, ic: "🔬", mem: [4, 5, 6] },
  hub:    { label: "Omega Hub",    col: "#F0A030", x: 200, y: 170, w: 140, h: 90, ic: "◉",  mem: [7, 8, 9] },
  garden: { label: "Rest Garden",  col: "#4DB6AC", x: 40,  y: 170, w: 100, h: 90, ic: "🌿", mem: [2] },
  tower:  { label: "Watchtower",   col: "#AB47BC", x: 400, y: 170, w: 90,  h: 90, ic: "👁", mem: [6, 7, 8] },
};
export const ZK = Object.keys(ZONES);
export const WW = 540;
export const WH = 310;

export const MEM_TIERS = [
  "s0 raw_logs", "s1 session", "s2 agent_ego", "s3 tool_mem", "s4 synthesis",
  "s5 domain", "s6 resonance", "s7 strategy", "s8 evolution", "s9 omega_core",
];

export const TASKS = [
  { t: "Refactor omega_pipeline.py", z: "forge", p: 3 },
  { t: "Consolidate s4_synthesis", z: "vault", p: 2 },
  { t: "Benchmark embedding recall", z: "lab", p: 2 },
  { t: "Sync WATAHA protocol v2", z: "hub", p: 3 },
  { t: "Audit circuit breakers", z: "tower", p: 1 },
  { t: "Write CHRONICLE entry", z: "hub", p: 1 },
  { t: "Optimize ChromaDB queries", z: "vault", p: 2 },
  { t: "Train mastery_engine", z: "lab", p: 3 },
  { t: "Deploy LiveBridge hotfix", z: "forge", p: 3 },
  { t: "Prune stale s0_raw_logs", z: "vault", p: 1 },
  { t: "Scan dep vulnerabilities", z: "tower", p: 2 },
  { t: "Build debug_swarm profile", z: "forge", p: 2 },
  { t: "Generate evolution report", z: "hub", p: 1 },
  { t: "Restore agent ego from s2", z: "vault", p: 3 },
  { t: "Test graceful degradation", z: "lab", p: 2 },
];

export const AGENT_DEFS = [
  { n: "Architect",       g: "A", c: "#F0A030", tr: ["planner", "visionary"], zone: "hub" },
  { n: "Builder",         g: "B", c: "#E8530E", tr: ["executor", "precise"], zone: "forge" },
  { n: "Explorer",        g: "E", c: "#8BC34A", tr: ["curious", "fast"], zone: "lab" },
  { n: "Critic",          g: "C", c: "#FF5252", tr: ["sharp", "honest"], zone: "tower" },
  { n: "Synthesizer",     g: "S", c: "#2196F3", tr: ["integrator", "calm"], zone: "vault" },
  { n: "Korzen",          g: "K", c: "#795548", tr: ["grounded", "wise"], zone: "garden" },
  { n: "Straznik",        g: "G", c: "#AB47BC", tr: ["vigilant", "loyal"], zone: "tower" },
  { n: "Adera",           g: "D", c: "#EC407A", tr: ["creative", "bold"], zone: "lab" },
  { n: "Tworczy",         g: "T", c: "#26C6DA", tr: ["generative", "free"], zone: "forge" },
  { n: "Energetyczny",    g: "N", c: "#FFEE58", tr: ["driven", "restless"], zone: "hub" },
  { n: "Synchronicznosc", g: "Y", c: "#66BB6A", tr: ["synced", "patient"], zone: "hub" },
  { n: "Collective",      g: "O", c: "#78909C", tr: ["shared", "distributed"], zone: "vault" },
  { n: "Autonomous",      g: "U", c: "#FF7043", tr: ["independent", "adaptive"], zone: "forge" },
  { n: "Evolution",       g: "V", c: "#CE93D8", tr: ["meta", "recursive"], zone: "hub" },
];

export const SPARK_TYPES = [
  "code review synapse", "knowledge transfer", "pattern alignment",
  "resonance sync", "memory consolidation", "evolution pulse",
  "strategy merge", "debug handshake", "concept bridge", "ego calibration",
];

export const SC = { idle: "#555", working: "#F0A030", thinking: "#2196F3", resting: "#4DB6AC", patrolling: "#AB47BC" };
export const TC = { info: "#666", work: "#F0A030", event: "#2196F3", alert: "#FF5252", spark: "#EC407A", mission: "#CE93D8", approve: "#FF9800" };

let _tid = 0;
export const resetTaskIds = () => { _tid = 0; };
export const mkTask = (tick, custom) => {
  if (custom) {
    return {
      id: custom.id || `t${_tid++}`,
      title: custom.title,
      zone: custom.zone,
      status: custom.status || "queued",
      assignee: custom.assignee || null,
      progress: custom.progress || 0,
      priority: custom.priority ?? 2,
      created: tick,
      started: custom.started || null,
      finished: null,
      missionId: custom.missionId || null,
      stepId: custom.stepId || null,
    };
  }
  const d = TASKS[Math.floor(Math.random() * TASKS.length)];
  return { id: `t${_tid++}`, title: d.t, zone: d.z, status: "queued", assignee: null, progress: 0, priority: d.p, created: tick, started: null, finished: null, missionId: null, stepId: null };
};

export const mkAgents = () => AGENT_DEFS.map((d, i) => ({
  id: `a${i}`, name: d.n, glyph: d.g, color: d.c, traits: d.tr, home: d.zone,
  pos: { x: 200 + Math.cos(i * 0.45) * 130, y: 155 + Math.sin(i * 0.45) * 85 },
  target: null, state: "idle", hp: 80 + Math.floor(Math.random() * 20),
  xp: Math.floor(Math.random() * 400), taskId: null, zone: null, history: [],
  tasksDone: 0, sparks: 0,
}));

export const lerp = (a, b, t) => a + (b - a) * Math.min(t, 1);
