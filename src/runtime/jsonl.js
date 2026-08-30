export function eventLine({ tick, mission, phase, type, text, extra }) {
  return {
    ts: new Date().toISOString(),
    tick,
    mission_id: mission?.mission_id || null,
    phase: phase || mission?.phase || "idle",
    type: type || "event",
    text,
    ...(extra || {}),
  };
}

export function toJsonl(lines) {
  return (lines || []).map((l) => JSON.stringify(l)).join("\n") + (lines?.length ? "\n" : "");
}

export function parseJsonl(text) {
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      out.push({ type: "parse_error", text: line.slice(0, 120) });
    }
  }
  return out;
}

export function downloadJsonl(filename, lines) {
  if (typeof window === "undefined") return toJsonl(lines);
  const blob = new Blob([toJsonl(lines)], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}
