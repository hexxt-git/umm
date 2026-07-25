// The agent adapter table — data only; behavior lives in the sibling modules.
// Keep it honest: an agent's web-access flag matters (a wrong flag ⇒ silent
// stale answers), so verify flags by hand and mark the ones you haven't.
import type { Agent } from "./types.js";
import { runModels } from "./discover.js";
import { listClaudeModels } from "./claude.js";
import { listCodexModels } from "./codex.js";
import { listCursorModels } from "./cursor.js";

export const AGENTS: Record<string, Agent> = {
  claude: {
    name: "Claude Code",
    bin: "claude",
    // prompt on stdin via -p; allow only the read-only web tools the skill uses.
    args: ["-p", "--allowedTools", "WebSearch,WebFetch"],
    input: "stdin",
    modelFlag: "--model",
    listModels: listClaudeModels,
  },
  antigravity: {
    name: "Antigravity (agy)",
    bin: "agy",
    args: ["-p"],
    input: "arg",
    modelFlag: "--model",
    listModels: () => runModels("agy", ["models"]), // effort is baked into names
  },
  opencode: {
    name: "opencode",
    bin: "opencode",
    args: ["run"],
    input: "arg",
    modelFlag: "--model",
    listModels: () => runModels("opencode", ["models"]),
  },
  cursor: {
    name: "Cursor CLI",
    bin: "cursor-agent",
    // --auto-review auto-runs safe read-only tools (incl. web search); without
    // it, -p mode leaves tool calls unapproved and answers from stale context.
    args: ["-p", "--auto-review"],
    input: "stdin",
    modelFlag: "--model",
    listModels: listCursorModels,
  },
  codex: {
    name: "Codex CLI",
    bin: "codex",
    args: ["exec"],
    input: "stdin",
    modelFlag: "-m",
    listModels: listCodexModels,
  },
};
