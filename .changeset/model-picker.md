---
"@hexxt/umm": minor
---

Add a model picker to the config wizard. Available models are discovered
dynamically from each installed agent — `agy`/`opencode`/`cursor` via their
`models` command, codex via its app-server `model/list` RPC, and claude by
reading model ids from its binary — so no model list is hardcoded. The chosen
model is passed to the agent on each run; agents that expose no model list keep
their own default.
