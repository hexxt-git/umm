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
  // How the prompt reaches the agent: piped to stdin, or appended as the final
  // argv element. Agents disagree on this, so it is per-adapter.
  input: "stdin" | "arg";
}

export const AGENTS: Record<string, Agent> = {
  claude: {
    name: "Claude Code",
    bin: "claude",
    // prompt on stdin via -p; allow only the read-only web tools the skill uses.
    args: ["-p", "--allowedTools", "WebSearch,WebFetch"],
    input: "stdin",
  },
  antigravity: {
    name: "Antigravity (agy)",
    bin: "agy",
    // -p / --print runs one prompt non-interactively; the prompt is the arg.
    args: ["-p"],
    input: "arg",
  },
  opencode: {
    name: "opencode",
    bin: "opencode",
    // `opencode run <message>` takes the prompt as a positional argument.
    args: ["run"],
    input: "arg",
  },
  cursor: {
    name: "Cursor CLI",
    bin: "cursor-agent",
    args: ["-p"],
    input: "stdin",
  },
  codex: {
    name: "Codex CLI",
    bin: "codex",
    args: ["exec"],
    input: "stdin",
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
