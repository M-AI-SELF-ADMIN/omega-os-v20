# OMEGA OS v20.1 — Operator Mission Control

SHAD / AUUU-os · OODA-L runtime + agent world + receipts + JSONL

The world map is the body. The command bar is the operator.

## Runtime contract

intent → Observe → Orient → Decide → [approval gate] → Act → Learn

- High-risk tools mcp.shell / mcp.github / mcp.deploy halt on APPROVE unless autonomy is A3.
- Act dispatches world tasks to agents by trait + home-zone affinity.
- Learn writes memory tiers s0, s1, s3, s4, s7, s8, s9.
- Tool adapters emit receipts (dry-run for high-risk MCP tools).
- Queue stacks intents while a cycle is running.
- JSONL chronicle is persisted and exportable from the header.

Autonomy: A1 always gate high-risk · A2 default gate · A3 auto-approve (unsafe).

```bash
npm install
npm run dev
npm test
```

Try:

- Refactor omega_pipeline.py and remember the strategy — no gate
- Deploy production hotfix to vercel — approval required
- Queue a second intent while the first is in Act
