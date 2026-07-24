import { execFileSync } from "node:child_process";
import type { Agent, AgentInfo } from "./types.js";
import { AGENTS } from "./index.js";

// True if the agent's binary is resolvable on PATH.
export function isInstalled(agent: Agent): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(probe, [agent.bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function listAgents(): AgentInfo[] {
  return Object.entries(AGENTS).map(([id, agent]) => ({
    id,
    ...agent,
    installed: isInstalled(agent),
  }));
}
