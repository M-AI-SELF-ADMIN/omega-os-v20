/**
 * OMEGA v20.2 — single-writer event store.
 * Operator events and the clock share one queue. Flush is synchronous
 * and non-reentrant. React reads via getSnapshot / subscribe.
 */
import { mkAgents, mkTask } from "../world/model.js";
import { simTick } from "../world/sim.js";
import {
  createMission, tickMission, resolveApproval, markStepDone,
} from "./engine.js";
import { executeTool } from "./tools.js";

const TERMINAL = new Set(["done", "error", "aborted"]);

export function initialState(seed = {}) {
  return {
    tick: 0,
    running: true,
    speed: 1,
    autonomy: "A2",
    agents: seed.agents || mkAgents(),
    tasks: seed.tasks || Array.from({ length: 4 }, () => mkTask(0)),
    mission: null,
    queue: [],
    logs: seed.logs || [{ tick: 0, text: "OMEGA CONSCIOUSNESS CORE v20.2 — STORE ONLINE", type: "event" }],
    sparks: [],
    history: [],
    receipts: [],
    ...seed,
  };
}

function pushLog(state, entry) {
  state.logs = [...state.logs.slice(-180), entry];
}

function live(mission) {
  return mission && !TERMINAL.has(mission.phase);
}

function applyTick(state) {
  const tick = state.tick + 1;
  const logsBuf = [];
  const log = (e) => logsBuf.push(e);
  const busy = live(state.mission);

  const sim = simTick(state.agents, state.tasks, tick, log, null, {
    missionActive: busy,
    sparks: state.sparks,
  });

  let mission = state.mission;
  const receipts = [...state.receipts];
  let history = state.history;
  let queue = state.queue;

  if (live(mission)) {
    for (const t of sim.tasks) {
      if (t.status === "done" && t.stepId && t.finished === tick) {
        const step = mission.plan.steps.find((s) => s.id === t.stepId);
        const tool = executeTool(step, mission, tick);
        mission = markStepDone(mission, t.stepId, tick, tool.receipt);
        if (tool.receipt) receipts.push(tool.receipt);
      }
    }
    const before = mission.phase;
    mission = tickMission(mission, { tick, agents: sim.agents });
    if (mission.phase === "act") {
      for (const step of mission.plan.steps) {
        if (step.status !== "running") continue;
        if (sim.tasks.some((t) => t.stepId === step.id)) continue;
        sim.tasks.push(mkTask(tick, {
          title: step.skill,
          zone: step.zone,
          assignee: step.assignee,
          priority: step.risk === "high" ? 3 : 2,
          missionId: mission.mission_id,
          stepId: step.id,
        }));
        log({ tick, text: `World task for ${step.skill}`, type: "mission" });
      }
    }
    if (before !== mission.phase) {
      log({
        tick,
        text: `OODA ${before} → ${mission.phase}`,
        type: mission.phase === "awaiting_approval" ? "approve" : "mission",
      });
    }
    if (TERMINAL.has(mission.phase) && before !== mission.phase) {
      history = [{ id: mission.mission_id, intent: mission.intent, phase: mission.phase, tick }, ...history].slice(0, 12);
      if (queue.length) {
        const next = queue[0];
        queue = queue.slice(1);
        try {
          mission = createMission(next.text, tick, next.autonomy || state.autonomy);
          log({ tick, text: `DEQUEUE ${mission.mission_id}: ${next.text}`, type: "mission" });
        } catch (err) {
          log({ tick, text: `Dequeue rejected: ${err.message}`, type: "alert" });
        }
      }
    }
  }

  const next = {
    ...state,
    tick,
    agents: sim.agents,
    tasks: sim.tasks,
    sparks: sim.sparks || [],
    mission,
    queue,
    history,
    receipts: receipts.slice(-80),
  };
  for (const e of logsBuf) pushLog(next, e);
  return next;
}

function applyLaunch(state, event) {
  const text = String(event.text || "").trim();
  if (!text) return state;
  const next = { ...state, logs: [...state.logs] };
  if (live(state.mission)) {
    const item = { text, autonomy: event.autonomy || state.autonomy, queuedAt: state.tick };
    next.queue = [...state.queue, item].slice(0, 12);
    pushLog(next, { tick: state.tick, text: `QUEUED behind ${state.mission.mission_id}: ${text}`, type: "mission" });
    return next;
  }
  try {
    next.mission = createMission(text, state.tick, event.autonomy || state.autonomy);
    pushLog(next, { tick: state.tick, text: `MISSION ${next.mission.mission_id}: ${text}`, type: "mission" });
  } catch (err) {
    pushLog(next, { tick: state.tick, text: `Mission rejected: ${err.message}`, type: "alert" });
  }
  return next;
}

function applyApprove(state, event) {
  if (!state.mission) return state;
  const next = { ...state, logs: [...state.logs] };
  next.mission = resolveApproval(state.mission, event.id, event.decision, state.tick);
  pushLog(next, {
    tick: state.tick,
    text: `Approval ${event.decision}: ${event.id}`,
    type: event.decision === "approved" ? "mission" : "alert",
  });
  return next;
}

export function reduce(state, event) {
  switch (event.type) {
    case "TICK":
      return applyTick(state);
    case "LAUNCH":
      return applyLaunch(state, event);
    case "APPROVE":
      return applyApprove(state, event);
    case "SET_RUNNING":
      return { ...state, running: !!event.value };
    case "SET_SPEED":
      return { ...state, speed: Math.max(1, Math.min(5, event.value | 0)) };
    case "SET_AUTONOMY":
      return { ...state, autonomy: event.value || state.autonomy };
    case "RESET":
      return initialState(event.seed || {});
    default:
      return state;
  }
}

export function createOmegaStore(seed) {
  let state = initialState(seed);
  const listeners = new Set();
  const queue = [];
  let flushing = false;

  const notify = () => {
    for (const fn of listeners) fn();
  };

  const flush = () => {
    if (flushing) return;
    flushing = true;
    while (queue.length) {
      const ev = queue.shift();
      state = reduce(state, ev);
    }
    flushing = false;
    notify();
  };

  return {
    dispatch(event) {
      queue.push(event);
      flush();
    },
    getSnapshot() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getQueueLength() {
      return queue.length;
    },
  };
}

export const store = createOmegaStore();
