---
"@hexxt/umm": patch
---

Fix Antigravity (agy) answering the wrong question: `-p` takes the prompt as its
value, so the injected `--effort low` was being sent as the question instead.
