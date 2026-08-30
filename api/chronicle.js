export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      service: "omega-chronicle",
      version: "20.1",
      methods: ["GET", "POST"],
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const raw = typeof req.body === "string"
    ? req.body
    : Array.isArray(req.body)
      ? req.body.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n")
      : req.body
        ? JSON.stringify(req.body)
        : "";

  const events = [];
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      if (trimmed.startsWith("{")) {
        events.push({ type: "parse_error", text: trimmed.slice(0, 120) });
      } else {
        events.push({ type: "event", text: trimmed.slice(0, 200) });
      }
    }
  }

  res.status(200).json({
    ok: true,
    ingested: events.length,
    last: events[events.length - 1] || null,
  });
}
