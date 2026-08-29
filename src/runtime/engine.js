/**
 * OMEGA OODA-L runtime kernel (browser + node).
 * This is a real state machine: intent → phases → plan → gated act → memory.
 * External side-effects (shell/deploy/git) never fire without an approval record.
 */

export const PHASES = ["observe", "orient", "decide", "act", "learn", "awaiting_approval", "done", "error", "aborted"];

export const SKILLS = [
  { id: "omega.planner",     zone: "hub",    traits: ["planner", "visionary"], risk: "low" },
  { id: "omega.builder",     zone: "forge",  traits: ["executor", "precise", "generative"], risk: "med" },
  { id: "omega.researcher",  zone: "lab",    traits: ["curious", "fast", "creative"], risk: "low" },
  { id: "omega.critic",      zone: "tower",  traits: ["sharp", "honest", "vigilant"], risk: "low" },
  { id: "omega.memory",      zone: "vault",  traits: ["integrator", "shared"], risk: "low" },
  { id: "omega.watchdog",    zone: "tower",  traits: ["vigilant", "loyal"], risk: "low" },
  { id: "omega.evolution",   zone: "hub",    traits: ["meta", "recursive"], risk: "med" },
  { id: "mcp.files",         zone: "forge",  traits: ["executor", "precise"], risk: "med" },
  { id: "mcp.shell",         zone: "tower",  traits: ["vigilant", "independent"], risk: "high" },
  { id: "mcp.github",        zone: "forge",  traits: ["executor", "adaptive"], risk: "high" },
  { id: "mcp.deploy",        zone: "hub",    traits: ["driven", "independent"], risk: "high" },
];

export const HIGH_RISK = new Set(["mcp.shell", "mcp.github", "mcp.deploy"]);

const RISK_WORDS = {
  deploy: ["deploy", "vercel", "production", "live", "hotfix", "release"],
  github: ["git", "github", "push", "repo", "commit", "pr "],
  shell: ["shell", "rm ", "delete", "wipe", "kill", "exec"],
  memory: ["memory", "chronicle", "remember", "s4", "s7", "s9", "vault"],
  research: ["research", "scan", "benchmark", "audit", "investigate"],
  build: ["refactor", "build", "code", "pipeline", "implement", "fix"],
};

let _mid = 0;
let _sid = 0;
let _aid = 0;
let _wid = 0;
export const resetRuntimeIds = () => { _mid = _sid = _aid = _wid = 0; };

export function parseIntent(text) {
  const raw = (text || "").trim();
  const low = raw.toLowerCase();
  const flags = {};
  for (const [k, words] of Object.entries(RISK_WORDS)) {
    flags[k] = words.some((w) => low.includes(w));
  }
  const skills = ["omega.planner"];
  if (flags.build) skills.push("omega.builder", "mcp.files");
  if (flags.research) skills.push("omega.researcher", "omega.critic");
  if (flags.memory) skills.push("omega.memory");
  if (flags.deploy) skills.push("mcp.deploy", "omega.watchdog");
  if (flags.github) skills.push("mcp.github", "omega.builder");
  if (flags.shell) skills.push("mcp.shell", "omega.watchdog");
  if (!flags.build && !flags.research && !flags.memory && !flags.deploy && !flags.github && !flags.shell) {
    skills.push("omega.builder", "omega.critic", "omega.memory");
  }
  skills.push("omega.evolution");
  return {
    raw,
    flags,
    skills: [...new Set(skills)],
    risk: flags.deploy || flags.github || flags.shell ? "high" : flags.build ? "med" : "low",
  };
}

export function pickAgent(agents, skill) {
  const spec = SKILLS.find((s) => s.id === skill) || SKILLS[0];
  const scored = agents.map((a) => {
    const traitHit = a.traits.filter((t) => spec.traits.includes(t)).length;
    const homeHit = a.home === spec.zone ? 1 : 0;
    const busy = a.state === "working" || a.state === "thinking" ? -2 : 0;
    const hp = (a.hp || 50) / 100;
    return { a, score: traitHit * 3 + homeHit * 2 + busy + hp };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored[0]?.a || agents[0];
}

export function createMission(intentText, tick = 0, autonomy = "A2") {
  const parsed = parseIntent(intentText);
  if (!parsed.raw) {
    throw new Error("empty intent");
  }
  const id = `m${++_mid}`;
  return {
    mission_id: id,
    intent: parsed.raw,
    parsed,
    autonomy,
    phase: "observe",
    created: tick,
    updated: tick,
    events: [{ tick, phase: "observe", text: `Intent captured: "${parsed.raw}"`, type: "mission" }],
    plan: { steps: [] },
    actions: [],
    memory_writes: [],
    artifacts: [],
    approvals: [],
    assignees: [],
    output: null,
  };
}

function ev(mission, tick, phase, text, type = "mission") {
  mission.events.push({ tick, phase, text, type });
  mission.updated = tick;
}

function writeMem(mission, tick, tier, key, value) {
  const rec = { id: `w${++_wid}`, tick, tier, key, value, mission_id: mission.mission_id };
  mission.memory_writes.push(rec);
  return rec;
}

export function buildPlan(parsed) {
  return parsed.skills.map((skill) => {
    const spec = SKILLS.find((s) => s.id === skill);
    return {
      id: `s${++_sid}`,
      skill,
      zone: spec?.zone || "hub",
      risk: spec?.risk || "low",
      status: "pending",
      assignee: null,
      tool: skill.startsWith("mcp.") ? skill : null,
    };
  });
}

export function needsApproval(step, autonomy) {
  if (!HIGH_RISK.has(step.skill)) return false;
  if (autonomy === "A3") return false;
  if (autonomy === "A1") return true;
  return true;
}

export function tickMission(mission, ctx) {
  const { tick, agents = [] } = ctx;
  if (!mission || ["done", "error", "aborted"].includes(mission.phase)) return mission;
  const m = {
    ...mission,
    events: [...mission.events],
    plan: { steps: mission.plan.steps.map((s) => ({ ...s })) },
    actions: [...mission.actions],
    memory_writes: [...mission.memory_writes],
    artifacts: [...mission.artifacts],
    approvals: mission.approvals.map((a) => ({ ...a })),
    assignees: [...mission.assignees],
  };

  if (m.phase === "observe") {
    ev(m, tick, "observe", `Parsed risk=${m.parsed.risk} flags=${Object.entries(m.parsed.flags).filter(([, v]) => v).map(([k]) => k).join(",") || "none"}`);
    writeMem(m, tick, 0, "intent.raw", m.intent);
    writeMem(m, tick, 1, "session.intent", m.intent);
    m.phase = "orient";
    ev(m, tick, "orient", "Orienting skills and agents");
    return m;
  }

  if (m.phase === "orient") {
    const steps = buildPlan(m.parsed);
    const assignees = [];
    for (const step of steps) {
      const agent = pickAgent(agents, step.skill);
      if (agent) {
        step.assignee = agent.id;
        assignees.push({ agentId: agent.id, name: agent.name, skill: step.skill, zone: step.zone });
      }
    }
    m.plan.steps = steps;
    m.assignees = assignees;
    ev(m, tick, "orient", `Skills: ${steps.map((s) => s.skill).join(" · ")}`);
    ev(m, tick, "orient", `Crew: ${[...new Set(assignees.map((a) => a.name))].join(", ") || "none"}`);
    m.phase = "decide";
    return m;
  }

  if (m.phase === "decide") {
    const gated = m.plan.steps.filter((s) => needsApproval(s, m.autonomy) && s.status === "pending");
    ev(m, tick, "decide", `Plan locked · ${m.plan.steps.length} steps · gated=${gated.length}`);
    writeMem(m, tick, 7, "strategy.plan", m.plan.steps.map((s) => s.skill).join(","));
    if (gated.length) {
      for (const step of gated) {
        const approval = {
          id: `ap${++_aid}`,
          mission_id: m.mission_id,
          stepId: step.id,
          action: step.skill,
          risk: step.risk,
          reason: `High-risk tool ${step.skill} requires operator approval (autonomy ${m.autonomy})`,
          status: "pending",
          tick,
        };
        m.approvals.push(approval);
        step.status = "blocked";
      }
      m.phase = "awaiting_approval";
      ev(m, tick, "awaiting_approval", `${gated.length} approval(s) pending`, "approve");
      return m;
    }
    m.phase = "act";
    ev(m, tick, "act", "No gates — entering Act");
    return m;
  }

  if (m.phase === "awaiting_approval") {
    const pending = m.approvals.filter((a) => a.status === "pending");
    if (pending.length) return m;
    const denied = m.approvals.some((a) => a.status === "denied");
    if (denied) {
      m.phase = "aborted";
      m.output = "Mission aborted: operator denied a high-risk action.";
      ev(m, tick, "aborted", m.output, "alert");
      writeMem(m, tick, 7, "strategy.abort", m.output);
      return m;
    }
    for (const s of m.plan.steps) if (s.status === "blocked") s.status = "pending";
    m.phase = "act";
    ev(m, tick, "act", "Approvals cleared — entering Act");
    return m;
  }

  if (m.phase === "act") {
    const next = m.plan.steps.find((s) => s.status === "pending");
    if (!next) {
      m.phase = "learn";
      ev(m, tick, "learn", "All steps executed — learning");
      return m;
    }
    next.status = "running";
    const action = {
      id: `act-${next.id}`,
      tick,
      skill: next.skill,
      zone: next.zone,
      assignee: next.assignee,
      status: "dispatched",
    };
    m.actions.push(action);
    ev(m, tick, "act", `Dispatch ${next.skill} → ${next.zone}`, "work");
    writeMem(m, tick, 3, `tool.${next.skill}`, "dispatched");
    return m;
  }

  if (m.phase === "learn") {
    const doneSteps = m.plan.steps.filter((s) => s.status === "done").length;
    const summary = `Mission ${m.mission_id} complete · ${doneSteps}/${m.plan.steps.length} steps · risk ${m.parsed.risk}`;
    m.output = summary;
    m.artifacts.push({ id: `art-${m.mission_id}`, kind: "mission_report", title: summary, tick });
    writeMem(m, tick, 4, "synthesis.report", summary);
    writeMem(m, tick, 8, "evolution.mission", m.intent);
    writeMem(m, tick, 9, "omega_core.last_mission", m.mission_id);
    ev(m, tick, "learn", summary);
    m.phase = "done";
    ev(m, tick, "done", "OODA-L cycle closed");
    return m;
  }

  return m;
}

export function resolveApproval(mission, approvalId, decision, tick) {
  const m = {
    ...mission,
    events: [...mission.events],
    approvals: mission.approvals.map((a) => ({ ...a })),
    plan: { steps: mission.plan.steps.map((s) => ({ ...s })) },
    memory_writes: [...mission.memory_writes],
  };
  const ap = m.approvals.find((a) => a.id === approvalId);
  if (!ap || ap.status !== "pending") return m;
  ap.status = decision === "approved" ? "approved" : "denied";
  ap.resolved = tick;
  ev(m, tick, "awaiting_approval", `${ap.action} ${ap.status}`, ap.status === "approved" ? "mission" : "alert");
  writeMem(m, tick, 7, `approval.${ap.action}`, ap.status);
  return m;
}

export function markStepDone(mission, stepId, tick) {
  const m = {
    ...mission,
    events: [...mission.events],
    plan: { steps: mission.plan.steps.map((s) => ({ ...s })) },
    actions: mission.actions.map((a) => ({ ...a })),
  };
  const step = m.plan.steps.find((s) => s.id === stepId);
  if (step) step.status = "done";
  const action = m.actions.find((a) => a.id === `act-${stepId}`);
  if (action) action.status = "done";
  if (step) ev(m, tick, "act", `Completed ${step.skill}`, "work");
  return m;
}

export function pendingApprovals(mission) {
  return (mission?.approvals || []).filter((a) => a.status === "pending");
}

export function memoryActivity(writes) {
  const act = new Array(10).fill(0);
  for (const w of writes || []) {
    if (w.tier >= 0 && w.tier <= 9) act[w.tier] = Math.min(1, act[w.tier] + 0.25);
  }
  return act;
}
