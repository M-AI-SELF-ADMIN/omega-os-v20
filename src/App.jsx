import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ZONES, ZK, WW, MEM_TIERS, SC, TC, mkAgents, mkTask } from "./world/model.js";
import { findSynapses, simTick } from "./world/sim.js";
import Canvas from "./world/Canvas.jsx";
import { Badge2, Bar, PHASE_COL } from "./ui/bits.jsx";
import {
  createMission, tickMission, resolveApproval, markStepDone,
  pendingApprovals, memoryActivity,
} from "./runtime/engine.js";

const TIER_COLORS = ["#555", "#607D8B", "#795548", "#FF9800", "#F0A030", "#8BC34A", "#AB47BC", "#2196F3", "#E8530E", "#F0A030"];

function MemoryHeatmap({ agents, tick, writes }) {
  const activity = useMemo(() => {
    const act = memoryActivity(writes);
    for (const a of agents) {
      if (a.zone && (a.state === "working" || a.state === "thinking")) {
        for (const t of ZONES[a.zone]?.mem || []) act[t] = Math.min(1, act[t] + 0.2);
      }
    }
    act[0] = Math.max(act[0], 0.08 + Math.sin(tick * 0.03) * 0.04);
    act[9] = Math.max(act[9], 0.1 + Math.sin(tick * 0.02) * 0.04);
    return act;
  }, [agents, tick, writes]);
  return (
    <div style={{ padding: "4px 12px 6px", borderBottom: "1px solid #181C28" }}>
      <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>MEMORY TIERS s0–s9</div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 24 }}>
        {activity.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }} title={MEM_TIERS[i]}>
            <div style={{ width: "100%", height: 18, background: "#12141C", borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
              <div style={{
                width: "100%", height: `${v * 100}%`,
                background: `linear-gradient(to top, ${TIER_COLORS[i]}44, ${TIER_COLORS[i]})`,
                borderRadius: 2, boxShadow: v > 0.5 ? `0 0 4px ${TIER_COLORS[i]}44` : "none",
              }} />
            </div>
            <span style={{ fontSize: 7, color: v > 0.3 ? TIER_COLORS[i] : "#2A2D38" }}>s{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [agents, setAgents] = useState(mkAgents);
  const [tasks, setTasks] = useState(() => Array.from({ length: 4 }, () => mkTask(0)));
  const [logs, setLogs] = useState([{ tick: 0, text: "OMEGA CONSCIOUSNESS CORE v20.0 — OPERATOR ONLINE", type: "event" }]);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selId, setSelId] = useState(null);
  const [tab, setTab] = useState("mission");
  const [sparks, setSparks] = useState([]);
  const [mission, setMission] = useState(null);
  const [history, setHistory] = useState([]);
  const [intent, setIntent] = useState("");
  const [autonomy, setAutonomy] = useState("A2");
  const logRef = useRef(null);
  const worldRef = useRef({ agents, tasks, mission });
  worldRef.current = { agents, tasks, mission };

  const addLog = useCallback((e) => setLogs((p) => [...p.slice(-180), e]), []);

  const launchMission = useCallback(() => {
    const text = intent.trim();
    if (!text) return;
    try {
      const m = createMission(text, worldRef.current.tick || tick, autonomy);
      setMission(m);
      setIntent("");
      setTab("mission");
      addLog({ tick, text: `MISSION ${m.mission_id}: ${text}`, type: "mission" });
    } catch (err) {
      addLog({ tick, text: `Mission rejected: ${err.message}`, type: "alert" });
    }
  }, [intent, autonomy, tick, addLog]);

  const onApprove = (id, decision) => {
    setMission((cur) => {
      if (!cur) return cur;
      const next = resolveApproval(cur, id, decision, tick);
      addLog({ tick, text: `Approval ${decision}: ${id}`, type: decision === "approved" ? "mission" : "alert" });
      return next;
    });
  };

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setTick((t) => t + 1), Math.max(35, 110 / speed));
    return () => clearInterval(iv);
  }, [running, speed]);

  useEffect(() => {
    if (tick === 0) return;
    const prev = worldRef.current;
    let nextMission = prev.mission;
    const logsBuf = [];
    const log = (e) => { logsBuf.push(e); };

    const busy = nextMission && !["done", "error", "aborted"].includes(nextMission.phase);
    let { agents: na, tasks: nt } = simTick(prev.agents, prev.tasks, tick, log, setSparks, { missionActive: busy });

    if (nextMission && !["done", "error", "aborted"].includes(nextMission.phase)) {
      for (const t of nt) {
        if (t.status === "done" && t.stepId && t.finished === tick) {
          nextMission = markStepDone(nextMission, t.stepId, tick);
        }
      }
      const before = nextMission.phase;
      nextMission = tickMission(nextMission, { tick, agents: na });
      if (nextMission.phase === "act") {
        for (const step of nextMission.plan.steps) {
          if (step.status !== "running") continue;
          const exists = nt.some((t) => t.stepId === step.id);
          if (!exists) {
            const task = mkTask(tick, {
              title: `${step.skill}`,
              zone: step.zone,
              assignee: step.assignee,
              priority: step.risk === "high" ? 3 : 2,
              missionId: nextMission.mission_id,
              stepId: step.id,
            });
            nt.push(task);
            log({ tick, text: `World task for ${step.skill}`, type: "mission" });
          }
        }
      }
      if (before !== nextMission.phase) {
        log({ tick, text: `OODA ${before} → ${nextMission.phase}`, type: nextMission.phase === "awaiting_approval" ? "approve" : "mission" });
      }
      if (["done", "aborted", "error"].includes(nextMission.phase) && before !== nextMission.phase) {
        setHistory((h) => [{ id: nextMission.mission_id, intent: nextMission.intent, phase: nextMission.phase, tick }, ...h].slice(0, 12));
      }
    }

    if (logsBuf.length) setLogs((p) => [...p.slice(-180), ...logsBuf]);
    setAgents(na);
    setTasks(nt);
    if (nextMission && (nextMission.phase !== prev.mission?.phase || nextMission.events.length !== prev.mission?.events.length || nextMission.approvals?.length !== prev.mission?.approvals?.length)) {
      setMission(nextMission);
    }
  }, [tick]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const sel = agents.find((a) => a.id === selId);
  const selTask = sel?.taskId ? tasks.find((t) => t.id === sel.taskId) : null;
  const pending = pendingApprovals(mission);
  const st = {
    working: agents.filter((a) => a.state === "working").length,
    done: tasks.filter((t) => t.status === "done").length,
    synapses: findSynapses(agents).length,
    phase: mission?.phase || "idle",
  };

  const S = {
    root: { background: "#0A0C12", color: "#C8CCD8", height: "100vh", fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace", fontSize: 12, display: "flex", flexDirection: "column", overflow: "hidden" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", borderBottom: "1px solid #181C28", background: "#0D0F16", flexShrink: 0, flexWrap: "wrap", gap: 6 },
    btn: { background: "none", border: "1px solid #333", color: "#888", borderRadius: 3, width: 22, height: 20, cursor: "pointer", fontFamily: "monospace", fontSize: 11 },
    switchBox: (on) => ({ width: 30, height: 16, borderRadius: 8, background: on ? "#F0A030" : "#333", cursor: "pointer", position: "relative", border: "none" }),
    switchKnob: (on) => ({ width: 12, height: 12, borderRadius: "50%", background: "#0A0C12", position: "absolute", top: 2, left: on ? 16 : 2, transition: "left 0.15s" }),
    tab: (active) => ({ flex: 1, padding: "7px 0", textAlign: "center", fontSize: 8, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", color: active ? "#F0A030" : "#444", borderBottom: active ? "2px solid #F0A030" : "2px solid transparent", background: "transparent", border: "none", borderBottomStyle: "solid", fontFamily: "inherit" }),
    progress: { height: 3, background: "#181C28", borderRadius: 2, overflow: "hidden", flex: 1 },
    progressFill: (pct) => ({ width: `${pct}%`, height: "100%", background: "#F0A030", borderRadius: 2 }),
    input: { background: "#12141C", border: "1px solid #1E2030", borderRadius: 3, color: "#CCC", padding: "6px 8px", fontSize: 11, fontFamily: "monospace", outline: "none", flex: 1 },
  };

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, color: "#F0A030", fontWeight: 800, letterSpacing: 2 }}>◉ OMEGA OS</span>
          <Badge2 color="#4DB6AC">v20.0</Badge2>
          <Badge2 color={PHASE_COL[st.phase] || "#8BC34A"}>{st.phase.toUpperCase()}</Badge2>
          {pending.length > 0 && <Badge2 color="#FF9800">{pending.length} APPROVAL</Badge2>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "#555", flexWrap: "wrap" }}>
          <span>TICK {tick}</span>
          <span style={{ color: "#F0A030" }}>{st.working}w</span>
          <span>{st.done} done</span>
          {st.synapses > 0 && <span style={{ color: "#EC407A" }}>{st.synapses} syn</span>}
          <span style={{ color: speed > 1 ? "#F0A030" : "#555" }}>×{speed}</span>
          <button style={S.btn} onClick={() => setSpeed((s) => Math.max(1, s - 1))}>−</button>
          <button style={S.btn} onClick={() => setSpeed((s) => Math.min(5, s + 1))}>+</button>
          <button style={S.switchBox(running)} onClick={() => setRunning((r) => !r)}><div style={S.switchKnob(running)} /></button>
          <span style={{ color: running ? "#8BC34A" : "#FF5252", fontSize: 9 }}>{running ? "LIVE" : "PAUSED"}</span>
        </div>
      </header>

      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid #181C28", background: "#0D0F16", flexShrink: 0 }}>
        <select value={autonomy} onChange={(e) => setAutonomy(e.target.value)} style={{ ...S.input, flex: "0 0 64px", padding: "6px 4px" }}>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="A3">A3</option>
        </select>
        <input
          style={S.input}
          placeholder="MISSION INTENT — e.g. Deploy production hotfix · Refactor pipeline and remember strategy"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && launchMission()}
        />
        <button onClick={launchMission} style={{ background: "#F0A030", border: "none", borderRadius: 3, color: "#0A0C12", padding: "6px 12px", fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "monospace" }}>RUN</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: "1 1 540px", display: "flex", flexDirection: "column", borderRight: "1px solid #181C28", minWidth: 0 }}>
          <div style={{ padding: 10, borderBottom: "1px solid #181C28", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#F0A030", fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>VIRTUAL WORLD</span>
              <span style={{ color: "#333", fontSize: 9 }}>body of the operator</span>
              {st.synapses > 0 && <span style={{ color: "#EC407A", fontSize: 9, marginLeft: "auto" }}>⚡ {st.synapses} synapses</span>}
            </div>
            <Canvas agents={agents} selId={selId} tick={tick} onSelect={setSelId} sparks={sparks} />
          </div>
          <div style={{ display: "flex", gap: 12, padding: "5px 12px", borderBottom: "1px solid #181C28", fontSize: 10, flexWrap: "wrap" }}>
            {Object.entries(ZONES).map(([k, z]) => {
              const n = agents.filter((a) => a.zone === k).length;
              return <span key={k} style={{ color: n > 0 ? z.col : "#282C38" }}>{z.ic} {n}</span>;
            })}
          </div>
          <MemoryHeatmap agents={agents} tick={tick} writes={mission?.memory_writes || []} />
          <div style={{ padding: "5px 12px", color: "#444", fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>CHRONICLE</div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 12px 8px" }}>
            {logs.slice(-50).map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 7, lineHeight: 1.65, fontSize: 10 }}>
                <span style={{ color: "#2A2D38", minWidth: 32, textAlign: "right" }}>{l.tick}</span>
                <span style={{ color: TC[l.type] || "#666" }}>{l.text}</span>
              </div>
            ))}
            <div ref={logRef} />
          </div>
        </div>

        <div style={{ width: 340, display: "flex", flexDirection: "column", minHeight: 0, background: "#0D0F16", flexShrink: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #181C28" }}>
            {["mission", "agents", "tasks", "memory", "approve"].map((k) => (
              <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>
                {k === "approve" && pending.length ? `APPROVE(${pending.length})` : k.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {tab === "mission" && (
              <div>
                {!mission && (
                  <div style={{ color: "#444", fontSize: 11, padding: 20, textAlign: "center" }}>
                    Submit intent in the command bar.<br />High-risk tools (shell / git / deploy) halt on APPROVE.
                  </div>
                )}
                {mission && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#888", fontSize: 10 }}>{mission.mission_id}</span>
                      <Badge2 color={PHASE_COL[mission.phase]}>{mission.phase}</Badge2>
                    </div>
                    <div style={{ fontSize: 12, color: "#EEE", marginBottom: 8 }}>{mission.intent}</div>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 10 }}>autonomy {mission.autonomy} · risk {mission.parsed.risk}</div>
                    <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>OODA-L</div>
                    {mission.events.slice(-14).map((e, i) => (
                      <div key={i} style={{ fontSize: 10, lineHeight: 1.6, color: PHASE_COL[e.phase] || "#888" }}>
                        [{e.phase}] {e.text}
                      </div>
                    ))}
                    <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: 1, margin: "10px 0 4px" }}>PLAN</div>
                    {mission.plan.steps.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3, color: "#999" }}>
                        <span>{s.skill}</span>
                        <Badge2 color={s.status === "done" ? "#4DB6AC" : s.status === "blocked" ? "#FF9800" : "#666"}>{s.status}</Badge2>
                      </div>
                    ))}
                    {mission.output && <div style={{ marginTop: 10, padding: 7, background: "#12141C", borderRadius: 4, fontSize: 10, color: "#4DB6AC" }}>{mission.output}</div>}
                    {history.length > 0 && (
                      <>
                        <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: 1, margin: "12px 0 4px" }}>PREVIOUS</div>
                        {history.map((h) => (
                          <div key={h.id} style={{ fontSize: 10, color: "#555", lineHeight: 1.6 }}>{h.id} · {h.phase} · {h.intent.slice(0, 40)}</div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "agents" && agents.map((a) => (
              <div key={a.id} onClick={() => setSelId(a.id)} style={{ display: "flex", gap: 7, padding: "5px 6px", marginBottom: 1, borderRadius: 3, cursor: "pointer", background: a.id === selId ? "#181C28" : "transparent", borderLeft: `2px solid ${a.id === selId ? "#F0A030" : "transparent"}` }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${SC[a.state]}`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>{a.glyph}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{a.name}</span>
                    <Badge2 color={SC[a.state]}>{a.state}</Badge2>
                  </div>
                  <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>HP {Math.round(a.hp)} · {a.home} · {a.traits[0]}</div>
                </div>
              </div>
            ))}
            {tab === "agents" && sel && (
              <div style={{ marginTop: 10, padding: 8, background: "#12141C", borderRadius: 4 }}>
                <Bar label="HP" value={sel.hp} max={100} color="#4DB6AC" />
                <Bar label="XP" value={sel.xp} max={1000} color="#F0A030" />
                {selTask && <div style={{ fontSize: 10, color: "#CCC", marginTop: 6 }}>{selTask.title} · {Math.round(selTask.progress)}%</div>}
              </div>
            )}

            {tab === "tasks" && ["active", "assigned", "queued", "done"].map((status) => {
              const fl = tasks.filter((t) => t.status === status);
              if (!fl.length) return null;
              const sc2 = { queued: "#555", assigned: "#2196F3", active: "#F0A030", done: "#4DB6AC" };
              return (
                <div key={status} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: sc2[status], marginBottom: 3 }}>{status} ({fl.length})</div>
                  {fl.slice(0, status === "done" ? 8 : 16).map((t) => (
                    <div key={t.id} style={{ padding: "4px 6px", marginBottom: 2, borderRadius: 3, background: "#12141C", fontSize: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#999" }}>{t.title}</span>
                        <span style={{ color: ZONES[t.zone]?.col }}>{ZONES[t.zone]?.ic}</span>
                      </div>
                      {t.status === "active" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <div style={S.progress}><div style={S.progressFill(t.progress)} /></div>
                          <span style={{ fontSize: 9, color: "#F0A030" }}>{Math.round(t.progress)}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {tab === "memory" && (
              <div>
                <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>LEDGER WRITES</div>
                {!(mission?.memory_writes || []).length && <div style={{ color: "#333", fontSize: 11 }}>No writes this mission.</div>}
                {(mission?.memory_writes || []).slice().reverse().map((w) => (
                  <div key={w.id} style={{ marginBottom: 6, padding: "5px 6px", background: "#12141C", borderRadius: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                      <span style={{ color: TIER_COLORS[w.tier] }}>s{w.tier} {MEM_TIERS[w.tier].split(" ")[1]}</span>
                      <span style={{ color: "#444" }}>t{w.tick}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#AAA", marginTop: 2 }}>{w.key}</div>
                    <div style={{ fontSize: 10, color: "#666" }}>{String(w.value).slice(0, 80)}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "approve" && (
              <div>
                <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>GATED ACTIONS</div>
                {!pending.length && <div style={{ color: "#333", fontSize: 11 }}>No pending approvals. A2/A1 gate mcp.shell / mcp.github / mcp.deploy.</div>}
                {pending.map((ap) => (
                  <div key={ap.id} style={{ padding: 8, background: "#12141C", borderRadius: 4, marginBottom: 8, border: "1px solid #FF980044" }}>
                    <div style={{ color: "#FF9800", fontSize: 11, fontWeight: 700 }}>{ap.action}</div>
                    <div style={{ color: "#888", fontSize: 10, margin: "4px 0 8px" }}>{ap.reason}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onApprove(ap.id, "approved")} style={{ background: "#4DB6AC", border: "none", borderRadius: 3, color: "#0A0C12", padding: "5px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>ALLOW</button>
                      <button onClick={() => onApprove(ap.id, "denied")} style={{ background: "transparent", border: "1px solid #FF5252", borderRadius: 3, color: "#FF5252", padding: "5px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>DENY</button>
                    </div>
                  </div>
                ))}
                {(mission?.approvals || []).filter((a) => a.status !== "pending").map((ap) => (
                  <div key={ap.id} style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>{ap.action} · {ap.status}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
