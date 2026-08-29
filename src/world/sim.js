import { ZONES, ZK, SPARK_TYPES, mkTask, lerp } from "./model.js";

export function findSynapses(agents) {
  const synapses = [];
  const byZone = {};
  for (const a of agents) {
    if (a.zone && (a.state === "working" || a.state === "thinking")) {
      if (!byZone[a.zone]) byZone[a.zone] = [];
      byZone[a.zone].push(a);
    }
  }
  for (const [zone, group] of Object.entries(byZone)) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) synapses.push({ a: group[i], b: group[j], zone });
    }
  }
  return synapses;
}

export function simTick(agents, tasks, tick, log, setSparks, opts = {}) {
  const missionActive = !!opts.missionActive;
  const na = agents.map((a) => ({ ...a, pos: { ...a.pos }, history: [...a.history] }));
  const nt = tasks.map((t) => ({ ...t }));

  for (const a of na) {
    if (a.target) {
      a.pos.x = lerp(a.pos.x, a.target.x, 0.07);
      a.pos.y = lerp(a.pos.y, a.target.y, 0.07);
      if (Math.hypot(a.pos.x - a.target.x, a.pos.y - a.target.y) < 3) a.target = null;
    }
    if (a.state === "resting") {
      a.hp = Math.min(100, a.hp + 0.3);
      if (a.hp > 92) { a.state = "idle"; a.zone = null; }
      continue;
    }
    if (a.state === "working" && a.taskId) {
      const task = nt.find((t) => t.id === a.taskId);
      if (task && task.status === "active") {
        task.progress = Math.min(100, task.progress + 0.5 + Math.random() * 0.9);
        a.hp = Math.max(0, a.hp - 0.07); a.xp += 0.12;
        if (task.progress >= 100) {
          task.status = "done"; task.finished = tick;
          a.state = "idle"; a.taskId = null; a.tasksDone = (a.tasksDone || 0) + 1;
          a.history.push(`✓ ${task.title}`);
          log({ tick, text: `${a.name} finished "${task.title}"`, type: "work" });
        }
      }
    }
    if (a.state === "idle" && !a.taskId) {
      if (a.hp < 28) {
        a.state = "resting";
        const g = ZONES.garden;
        a.target = { x: g.x + 15 + Math.random() * 65, y: g.y + 20 + Math.random() * 50 };
        a.zone = "garden";
        log({ tick, text: `${a.name} → resting`, type: "info" });
        continue;
      }
      const preferred = nt.filter((t) => t.status === "queued" && t.assignee === a.id);
      const open = nt.filter((t) => t.status === "queued" && !t.assignee);
      const pool = preferred.length ? preferred : open.sort((x, y) => y.priority - x.priority);
      if (pool.length) {
        const task = preferred.length ? preferred[0] : pool[0];
        task.status = "assigned"; task.assignee = a.id; task.started = tick;
        a.taskId = task.id; a.state = "thinking"; a.zone = task.zone;
        const z = ZONES[task.zone];
        a.target = { x: z.x + 12 + Math.random() * (z.w - 24), y: z.y + 18 + Math.random() * (z.h - 28) };
        log({ tick, text: `${a.name} → "${task.title}"`, type: "work" });
      } else if (!missionActive && Math.random() < 0.015) {
        a.state = "patrolling";
        const rz = ZK[Math.floor(Math.random() * ZK.length)];
        const z = ZONES[rz];
        a.target = { x: z.x + Math.random() * z.w, y: z.y + Math.random() * z.h };
        a.zone = rz;
      }
    }
    if (a.state === "thinking" && !a.target) {
      const task = nt.find((t) => t.id === a.taskId);
      if (task) { task.status = "active"; a.state = "working"; }
    }
    if (a.state === "patrolling" && !a.target) a.state = "idle";
  }

  if (!missionActive && tick % 55 === 0 && nt.filter((t) => t.status === "queued").length < 5) {
    const t = mkTask(tick);
    nt.push(t);
    log({ tick, text: `Queued: "${t.title}"`, type: "event" });
  }

  if (tick % 30 === 0) {
    const byZone = {};
    for (const a of na) {
      if (a.zone && a.state === "working") {
        if (!byZone[a.zone]) byZone[a.zone] = [];
        byZone[a.zone].push(a);
      }
    }
    for (const [, group] of Object.entries(byZone)) {
      if (group.length >= 2 && Math.random() < 0.6) {
        const i = Math.floor(Math.random() * group.length);
        let j = Math.floor(Math.random() * group.length);
        if (j === i) j = (j + 1) % group.length;
        const aa = group[i], bb = group[j];
        const sparkType = SPARK_TYPES[Math.floor(Math.random() * SPARK_TYPES.length)];
        aa.sparks = (aa.sparks || 0) + 1;
        bb.sparks = (bb.sparks || 0) + 1;
        aa.xp += 2; bb.xp += 2;
        log({ tick, text: `${aa.name} ↔ ${bb.name}: ${sparkType}`, type: "spark" });
        setSparks((prev) => [...prev.filter((s) => tick - s.tick < 15), { tick, ax: aa.pos.x, ay: aa.pos.y, bx: bb.pos.x, by: bb.pos.y }]);
      }
    }
  }

  return { agents: na, tasks: nt };
}
