// What an agent must expose for `umm continue` to reopen its own session
// rather than reseeding a fresh one. Absent ⇒ the agent takes the reseed path.
export interface Resume {
  // Extra print-mode args that make the agent emit a machine-readable envelope
  // carrying its session id alongside the answer.
  printArgs: string[];
  // Pulls the answer (and id, when present) out of that envelope.
  parse: (stdout: string) => { text: string; sessionId?: string };
  // Args that reopen that session interactively. Replaces `args` entirely.
  args: (sessionId: string) => string[];
}

export interface Agent {
  name: string;
  bin: string;
  args: string[];
  // How the prompt reaches the agent: piped to stdin, or as the last arg.
  input: "stdin" | "arg";
  // Flag preceding a model name; absent ⇒ no model step in the wizard.
  modelFlag?: string;
  // Absent ⇒ agent uses its own default. May be async and may throw.
  listModels?: () => string[] | Promise<string[]>;
  // Args always injected to force low reasoning effort — umm is for quick
  // lookups, not deep research. Absent ⇒ agent has no effort flag.
  effortArgs?: string[];
  // Put model/effort flags *before* `args` instead of after. Needed when the
  // last entry in `args` consumes the next argument as the prompt (agy's -p),
  // which would otherwise swallow a flag and drop the real question.
  flagsFirst?: boolean;
  // Session capture + native resume. Absent ⇒ reseed only.
  resume?: Resume;
  // Args that open an interactive session seeded with an initial prompt,
  // replacing `args`. Absent ⇒ the prompt is passed positionally.
  seedArgs?: (prompt: string) => string[];
}

export interface AgentInfo extends Agent {
  id: string;
  installed: boolean;
}
