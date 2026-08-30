/**
 * Tool adapters. High-risk tools never touch a real shell/git/deploy from the browser.
 * They emit structured receipts the operator can audit and export as JSONL.
 */

export function executeTool(step, mission, tick) {
  const skill = step?.skill || "unknown";
  const base = {
    skill,
    zone: step?.zone || "hub",
    mission_id: mission?.mission_id,
    step_id: step?.id,
    tick,
    dry_run: skill.startsWith("mcp."),
  };

  if (skill === "mcp.deploy") {
    return {
      status: "receipt",
      receipt: {
        ...base,
        kind: "deploy",
        target: "production",
        note: "Gated deploy receipt — no Vercel API call from the browser kernel.",
        artifact: `deploy://${mission.mission_id}/${step.id}`,
      },
    };
  }
  if (skill === "mcp.github") {
    return {
      status: "receipt",
      receipt: {
        ...base,
        kind: "github",
        note: "Gated git receipt — no push from the browser kernel.",
        artifact: `git://${mission.mission_id}/${step.id}`,
      },
    };
  }
  if (skill === "mcp.shell") {
    return {
      status: "receipt",
      receipt: {
        ...base,
        kind: "shell",
        note: "Gated shell receipt — command not executed.",
        artifact: `shell://${mission.mission_id}/${step.id}`,
      },
    };
  }
  if (skill === "mcp.files" || skill === "omega.builder") {
    return {
      status: "ok",
      receipt: {
        ...base,
        kind: "files",
        dry_run: false,
        note: `Workspace patch planned for "${mission.intent}"`,
        artifact: `file://omega/${mission.mission_id}/${step.id}.md`,
      },
    };
  }
  if (skill === "omega.memory") {
    return {
      status: "ok",
      receipt: {
        ...base,
        kind: "memory",
        dry_run: false,
        note: "Memory write committed to ledger",
        artifact: `mem://${mission.mission_id}`,
      },
    };
  }
  return {
    status: "ok",
    receipt: {
      ...base,
      kind: "cognitive",
      dry_run: false,
      note: `${skill} completed`,
      artifact: `omega://${skill}/${step.id}`,
    },
  };
}
