const KEY = "omega-os-v20-ledger";

const EMPTY = { history: [], writes: [], receipts: [], jsonl: [], queue: [] };

export function loadLedger() {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const data = JSON.parse(raw);
    return {
      history: Array.isArray(data.history) ? data.history.slice(0, 20) : [],
      writes: Array.isArray(data.writes) ? data.writes.slice(-200) : [],
      receipts: Array.isArray(data.receipts) ? data.receipts.slice(-80) : [],
      jsonl: Array.isArray(data.jsonl) ? data.jsonl.slice(-400) : [],
      queue: Array.isArray(data.queue) ? data.queue.slice(0, 12) : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveLedger(partial) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadLedger();
    const next = {
      history: (partial.history ?? prev.history).slice(0, 20),
      writes: (partial.writes ?? prev.writes).slice(-200),
      receipts: (partial.receipts ?? prev.receipts).slice(-80),
      jsonl: (partial.jsonl ?? prev.jsonl).slice(-400),
      queue: (partial.queue ?? prev.queue).slice(0, 12),
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    const added = next.jsonl.slice(prev.jsonl.length);
    if (added.length) flushChronicle(added);
  } catch {
    /* quota / private mode */
  }
}

export function flushChronicle(lines) {
  if (typeof window === "undefined" || !lines?.length) return;
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  const endpoints = ["/api/chronicle", "https://omega-chronicle.vercel.app/api/chronicle"];
  for (const url of endpoints) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    }).catch(() => {});
  }
}
