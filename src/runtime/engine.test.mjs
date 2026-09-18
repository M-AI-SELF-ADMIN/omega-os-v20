import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  createMission, tickMission, resolveApproval, resetRuntimeIds,
} from "./engine.js";

test("full mission cycle with approval", () => {
  resetRuntimeIds();
  const agents = [
    { id: "a0", name: "Architect", traits: ["planner", "visionary"], home: "hub", state: "idle", hp: 90 },
    { id: "a1", name: "Watch", traits: ["vigilant", "loyal"], home: "tower", state: "idle", hp: 90 },
    { id: "a2", name: "Builder", traits: ["executor", "precise"], home: "forge", state: "idle", hp: 90 },
  ];
  let m = createMission("Deploy production hotfix to vercel", 0, "A2");
  m = tickMission(m, { tick: 1, agents });
  assert.equal(m.phase, "orient");
  m = tickMission(m, { tick: 2, agents });
  assert.equal(m.phase, "decide");
  m = tickMission(m, { tick: 3, agents });
  assert.equal(m.phase, "awaiting_approval");
  const ap = m.approvals.find((a) => a.status === "pending");
  assert.ok(ap);
  m = resolveApproval(m, ap.id, "approved", 4);
  m = tickMission(m, { tick: 5, agents });
  assert.equal(m.phase, "act");
});

test("deny aborts", () => {
  resetRuntimeIds();
  let m = createMission("git push to the repo", 0, "A2");
  m = tickMission(m, { tick: 1, agents: [] });
  m = tickMission(m, { tick: 2, agents: [] });
  m = tickMission(m, { tick: 3, agents: [] });
  assert.equal(m.phase, "awaiting_approval");
  for (const ap of m.approvals.filter((a) => a.status === "pending")) {
    m = resolveApproval(m, ap.id, "denied", 4);
  }
  m = tickMission(m, { tick: 5, agents: [] });
  assert.equal(m.phase, "aborted");
});
