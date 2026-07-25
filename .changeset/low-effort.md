---
"@hexxt/umm": minor
---

Always run agents at low reasoning effort. umm is built for quick lookups, not
deep research, so every request now forces the lowest effort level on agents
that support it — `--effort low` for claude and antigravity, and
`-c model_reasoning_effort=low` for codex. Agents without an effort flag
(cursor, opencode) are unaffected. This is not user-configurable.
