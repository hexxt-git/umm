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
}

export interface AgentInfo extends Agent {
  id: string;
  installed: boolean;
}
