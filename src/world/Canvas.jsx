import React, { useEffect, useRef } from "react";
import { ZONES, WW, WH, SC } from "./model.js";
import { findSynapses } from "./sim.js";

function drawWorld(ctx, agents, selId, tick, dpr, sparks) {
  ctx.save(); ctx.scale(dpr, dpr);
  ctx.fillStyle = "#0C0E14"; ctx.fillRect(0, 0, WW, WH);
  ctx.fillStyle = "#151822";
  for (let gx = 0; gx < WW; gx += 20) for (let gy = 0; gy < WH; gy += 20) ctx.fillRect(gx, gy, 1, 1);
  const cens = Object.values(ZONES).map((z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 }));
  ctx.strokeStyle = "#181C28"; ctx.lineWidth = 1;
  for (let i = 0; i < cens.length; i++) for (let j = i + 1; j < cens.length; j++) {
    ctx.beginPath(); ctx.moveTo(cens[i].x, cens[i].y); ctx.lineTo(cens[j].x, cens[j].y); ctx.stroke();
  }
  for (const z of Object.values(ZONES)) {
    ctx.strokeStyle = z.col + "44"; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
    ctx.fillStyle = z.col + "0A"; ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.fillStyle = z.col + "88"; ctx.font = "600 9px monospace";
    ctx.fillText(`${z.ic} ${z.label}`, z.x + 5, z.y + 13);
  }
  const synapses = findSynapses(agents);
  for (const syn of synapses) {
    const alpha = 0.15 + Math.sin(tick * 0.1 + syn.a.pos.x * 0.01) * 0.12;
    const zCol = ZONES[syn.zone]?.col || "#F0A030";
    ctx.strokeStyle = zCol; ctx.globalAlpha = alpha; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(syn.a.pos.x, syn.a.pos.y);
    const mx = (syn.a.pos.x + syn.b.pos.x) / 2 + Math.sin(tick * 0.08) * 6;
    const my = (syn.a.pos.y + syn.b.pos.y) / 2 + Math.cos(tick * 0.08) * 6;
    ctx.quadraticCurveTo(mx, my, syn.b.pos.x, syn.b.pos.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2);
    ctx.fillStyle = zCol; ctx.globalAlpha = alpha + 0.1; ctx.fill(); ctx.globalAlpha = 1;
  }
  for (const sp of sparks) {
    const age = tick - sp.tick;
    if (age > 12) continue;
    const fade = 1 - age / 12;
    ctx.globalAlpha = fade * 0.6; ctx.strokeStyle = "#EC407A"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sp.ax, sp.ay); ctx.lineTo(sp.bx, sp.by); ctx.stroke();
    const cx = (sp.ax + sp.bx) / 2, cy = (sp.ay + sp.by) / 2;
    ctx.beginPath(); ctx.arc(cx, cy, 4 + age * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = "#EC407A"; ctx.globalAlpha = fade * 0.3; ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const a of agents) {
    const sel = a.id === selId;
    if (sel) {
      const pulse = 3 + Math.sin(tick * 0.14) * 2;
      ctx.beginPath(); ctx.arc(a.pos.x, a.pos.y, 13 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = a.color + "18"; ctx.fill();
      ctx.strokeStyle = a.color + "66"; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(a.pos.x, a.pos.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#0C0E14"; ctx.fill();
    ctx.strokeStyle = SC[a.state] || "#555"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = a.color; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(a.glyph, a.pos.x, a.pos.y + 1);
    ctx.fillStyle = "#666"; ctx.font = "8px monospace";
    ctx.fillText(a.name.slice(0, 5), a.pos.x, a.pos.y + 17);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

export default function Canvas({ agents, selId, tick, onSelect, sparks }) {
  const ref = useRef(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = WW * dpr; c.height = WH * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    drawWorld(ctx, agents, selId, tick, dpr, sparks);
  }, [agents, selId, tick, dpr, sparks]);
  const click = (e) => {
    const c = ref.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (WW / r.width), my = (e.clientY - r.top) * (WH / r.height);
    let hit = null;
    for (const a of agents) if (Math.hypot(a.pos.x - mx, a.pos.y - my) < 14) { hit = a.id; break; }
    onSelect(hit);
  };
  return <canvas ref={ref} onClick={click} style={{ width: "100%", maxWidth: WW, height: "auto", aspectRatio: `${WW}/${WH}`, cursor: "crosshair", borderRadius: 4, border: "1px solid #1A1D28" }} />;
}
