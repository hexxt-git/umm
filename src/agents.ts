// Agent adapters as data. Each entry says how to detect the agent (its binary
// on PATH) and how to invoke it non-interactively with a prompt on stdin.
//
// `webFlag` intent: most agents refuse web access in non-interactive mode
// unless explicitly told otherwise, which would silently answer volatile
// questions from stale training data. Verify each agent's real flags by hand
// before trusting them — these change often.
import { execFileSync } from "node:child_process";

export interface Agent {
  name: string;
  bin: string;
  args: string[];
  stdin: boolean;
}

export const AGENTS: Record<string, Agent> = {
  claude: {
    name: "Claude Code",
    bin: "claude",
    // prompt on stdin via -p; allow the web tools the skill relies on.
    args: ["-p", "--allowedTools", "WebSearch,WebFetch"],
    stdin: true,
  },
  cursor: {
    name: "Cursor CLI",
    bin: "cursor-agent",
    args: ["-p"],
    stdin: true,
  },
  gemini: {
    name: "Gemini CLI",
    bin: "gemini",
    args: ["-p"],
    stdin: true,
  },
  opencode: {
    name: "opencode",
    bin: "opencode",
    args: ["run"],
    stdin: true,
  },
  codex: {
    name: "Codex CLI",
    bin: "codex",
    args: ["exec"],
    stdin: true,
  },
};

export interface AgentInfo extends Agent {
  id: string;
  installed: boolean;
}

// Returns true if the agent's binary is resolvable on PATH.
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
