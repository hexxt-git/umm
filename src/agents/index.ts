// The agent adapter table — data only; behavior lives in the sibling modules.
// Web-access flags matter (a wrong flag ⇒ silent stale answers); verify by hand.
// So does `resume`: its printArgs change what run.ts parses as the answer, so
// only wire it for an agent whose envelope you have actually seen.
import type { Agent } from "./types.js";
import { runModels } from "./discover.js";
import { listClaudeModels } from "./claude.js";
import { listCodexModels } from "./codex.js";
import { listCursorModels } from "./cursor.js";
import {
  parseResultEnvelope,
  parseCodexEvents,
  parseOpencodeEvents,
} from "./session.js";

export const AGENTS: Record<string, Agent> = {
  claude: {
    name: "Claude Code",
    bin: "claude",
    args: ["-p", "--allowedTools", "WebSearch,WebFetch"],
    input: "stdin",
    modelFlag: "--model",
    listModels: listClaudeModels,
    effortArgs: ["--effort", "low"],
    resume: {
      printArgs: ["--output-format", "json"],
      parse: parseResultEnvelope,
      args: (id) => ["--resume", id],
    },
  },
  antigravity: {
    name: "Antigravity (agy)",
    bin: "agy",
    // -p takes the prompt as its *value*, so nothing may come between it and
    // the question — hence flagsFirst.
    args: ["-p"],
    input: "arg",
    flagsFirst: true,
    modelFlag: "--model",
    listModels: () => runModels("agy", ["models"]),
    effortArgs: ["--effort", "low"],
    // Has --conversation <id>, but print mode exposes no id to capture, so
    // continue reseeds. -i runs a prompt and stays interactive.
    seedArgs: (prompt) => ["-i", prompt],
  },
  opencode: {
    name: "opencode",
    bin: "opencode",
    args: ["run"],
    input: "arg",
    modelFlag: "--model",
    listModels: () => runModels("opencode", ["models"]),
    resume: {
      printArgs: ["--format", "json"],
      parse: parseOpencodeEvents,
      // -s reopens the session in the TUI; --prompt seeds a fresh one.
      args: (id) => ["-s", id],
    },
    seedArgs: (prompt) => ["--prompt", prompt],
  },
  cursor: {
    name: "Cursor CLI",
    bin: "cursor-agent",
    // --auto-review auto-runs read-only tools (incl. web search); without it,
    // -p leaves tool calls unapproved and answers from stale context.
    args: ["-p", "--auto-review"],
    input: "stdin",
    modelFlag: "--model",
    listModels: listCursorModels,
    resume: {
      printArgs: ["--output-format", "json"],
      parse: parseResultEnvelope,
      args: (id) => ["--resume", id],
    },
  },
  codex: {
    name: "Codex CLI",
    bin: "codex",
    args: ["exec"],
    input: "stdin",
    modelFlag: "-m",
    listModels: listCodexModels,
    effortArgs: ["-c", "model_reasoning_effort=low"],
    resume: {
      printArgs: ["--json"],
      parse: parseCodexEvents,
      args: (id) => ["resume", id],
    },
  },
};
