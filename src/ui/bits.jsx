import React from "react";

export const Badge2 = ({ children, color }) => (
  <span style={{ display: "inline-block", fontSize: 8, padding: "1px 6px", border: `1px solid ${color}44`, color, borderRadius: 3, fontFamily: "monospace", letterSpacing: 0.5 }}>{children}</span>
);

export const Bar = ({ label, value, max, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "monospace", marginBottom: 3 }}>
    <span style={{ color: "#666", width: 20, textAlign: "right" }}>{label}</span>
    <div style={{ flex: 1, height: 4, background: "#181C28", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color, borderRadius: 2 }} />
    </div>
    <span style={{ color, width: 26, textAlign: "right", fontSize: 9 }}>{Math.round(value)}</span>
  </div>
);

export const PHASE_COL = {
  observe: "#2196F3",
  orient: "#8BC34A",
  decide: "#F0A030",
  act: "#E8530E",
  learn: "#CE93D8",
  awaiting_approval: "#FF9800",
  done: "#4DB6AC",
  error: "#FF5252",
  aborted: "#FF5252",
};
