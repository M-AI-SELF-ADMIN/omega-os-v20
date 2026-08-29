const KEY = "omega-os-v20-ledger";

export function loadLedger() {
  if (typeof window === "undefined") return { history: [], writes: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { history: [], writes: [] };
    const data = JSON.parse(raw);
    return {
      history: Array.isArray(data.history) ? data.history.slice(0, 20) : [],
      writes: Array.isArray(data.writes) ? data.writes.slice(-200) : [],
    };
  } catch {
    return { history: [], writes: [] };
  }
}

export function saveLedger({ history = [], writes = [] }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ history: history.slice(0, 20), writes: writes.slice(-200) }));
  } catch {
    /* quota / private mode */
  }
}
