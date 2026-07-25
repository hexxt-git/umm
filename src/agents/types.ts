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
}

export interface AgentInfo extends Agent {
  id: string;
  installed: boolean;
}
