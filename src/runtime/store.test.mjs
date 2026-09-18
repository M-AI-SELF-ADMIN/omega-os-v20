import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createOmegaStore } from "./store.js";
import { resetRuntimeIds } from "./engine.js";
import { resetTaskIds } from "../world/model.js";

function boot(seed = {}) {
  resetRuntimeIds();
  resetTaskIds();
  return createOmegaStore({
    running: false,
    agents: [
      { id: "a0", name: "Architect", glyph: "A", color: "#F0A030", traits: ["planner", "visionary"], home: "hub", pos: { x: 200, y: 170 }, target: null, state: "idle", hp: 99, xp: 10, taskId: null, zone: null, history: [], tasksDone: 0, sparks: 0 },
      { id: "a1", name: "Watch", glyph: "G", color: "#AB47BC", traits: ["vigilant", "loyal"], home: "tower", pos: { x: 400, y: 170 }, target: null, state: "idle", hp: 99, xp: 10, taskId: null, zone: null, history: [], tasksDone: 0, sparks: 0 },
    ],
    tasks: [],
    logs: [],
    ...seed,
  });
}

test("approve then tick does not lose the allow", () => {
  const s = boot();
  s.dispatch({ type: "LAUNCH", text: "Deploy production hotfix to vercel", autonomy: "A2" });
  for (let i = 0; i < 3; i++) s.dispatch({ type: "TICK" });
  let st = s.getSnapshot();
  assert.equal(st.mission.phase, "awaiting_approval");
  const ap = st.mission.approvals.find((a) => a.status === "pending");
  s.dispatch({ type: "APPROVE", id: ap.id, decision: "approved" });
  s.dispatch({ type: "TICK" });
  st = s.getSnapshot();
  assert.equal(st.mission.approvals[0].status, "approved");
  assert.equal(st.mission.phase, "act");
});

test("tick then approve in one flush keeps allow", () => {
  const s = boot();
  s.dispatch({ type: "LAUNCH", text: "Deploy production hotfix", autonomy: "A2" });
  for (let i = 0; i < 3; i++) s.dispatch({ type: "TICK" });
  const ap = s.getSnapshot().mission.approvals[0];
  s.dispatch({ type: "TICK" });
  s.dispatch({ type: "APPROVE", id: ap.id, decision: "approved" });
  const st = s.getSnapshot();
  assert.equal(st.mission.approvals[0].status, "approved");
  assert.equal(st.mission.phase, "awaiting_approval");
});

test("second launch queues behind live mission", () => {
  const s = boot();
  s.dispatch({ type: "LAUNCH", text: "Research embedding recall", autonomy: "A3" });
  assert.equal(s.getSnapshot().mission.phase, "observe");
  s.dispatch({ type: "LAUNCH", text: "Refactor omega pipeline", autonomy: "A3" });
  const st = s.getSnapshot();
  assert.equal(st.queue.length, 1);
  assert.match(st.queue[0].text, /Refactor/);
  assert.equal(st.mission.intent, "Research embedding recall");
});

test("reentrant dispatch during flush serializes", () => {
  const s = boot();
  let seen = 0;
  s.subscribe(() => {
    seen += 1;
    if (seen === 1) s.dispatch({ type: "SET_SPEED", value: 3 });
  });
  s.dispatch({ type: "SET_RUNNING", value: false });
  assert.equal(s.getSnapshot().running, false);
  assert.equal(s.getSnapshot().speed, 3);
  assert.equal(s.getQueueLength(), 0);
});
