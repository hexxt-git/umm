# @hexxt/umm

## 0.3.1

### Patch Changes

- 8fd1fcf: Recover gracefully from common config and history mistakes.
- 8ef8f0e: Keep rendered answers readable and width-safe in narrow terminals.

## 0.3.0

### Minor Changes

- ebf112b: Add `umm continue` — reopens a past answer in a real interactive agent session,
  resuming the original session where the agent exposes an id and replaying the
  exchange where it doesn't. `--pick` chooses an older ask from history, which is
  now logged to `~/.local/state/umm/history.jsonl`.

## 0.2.2

### Patch Changes

- c6d4843: Fix `umm --config` crashing at the final step and reporting "cancelled — nothing
  saved", which made the setup wizard impossible to complete.

## 0.2.1

### Patch Changes

- 7ddc706: Fix Antigravity (agy) answering the wrong question: `-p` takes the prompt as its
  value, so the injected `--effort low` was being sent as the question instead.

## 0.2.0

### Minor Changes

- 74a2cb0: Always run agents at low reasoning effort. umm is built for quick lookups, not
  deep research, so every request now forces the lowest effort level on agents
  that support it — `--effort low` for claude and antigravity, and
  `-c model_reasoning_effort=low` for codex. Agents without an effort flag
  (cursor, opencode) are unaffected. This is not user-configurable.
- 74a2cb0: Add a model picker to the config wizard. Available models are discovered
  dynamically from each installed agent — `agy`/`opencode`/`cursor` via their
  `models` command, codex via its app-server `model/list` RPC, and claude by
  reading model ids from its binary — so no model list is hardcoded. The chosen
  model is passed to the agent on each run; agents that expose no model list keep
  their own default. Long model lists (cursor exposes hundreds) scroll within a
  bounded window instead of flooding the terminal.
