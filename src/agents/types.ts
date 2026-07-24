export interface Agent {
  name: string;
  bin: string;
  args: string[];
  // How the prompt reaches the agent: piped to stdin, or appended as the last arg.
  input: "stdin" | "arg";
  // Flag preceding a chosen model name; absent ⇒ no model step in the wizard.
  modelFlag?: string;
  // Lists the models the user can pick; absent ⇒ agent uses its own default.
  // May be async and may throw — discoverModels() awaits and guards it.
  listModels?: () => string[] | Promise<string[]>;
}

export interface AgentInfo extends Agent {
  id: string;
  installed: boolean;
}
