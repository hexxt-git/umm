# umm 🤔

**A faster way to ask.** Stop opening a browser tab. Stop starting a whole chat.
Just type `umm` and your question — get a tight, structured answer right in your
terminal.

```console
$ umm why is the sky blue

why the sky is blue

Sunlight is made of every colour mixed together, and when it hits the air the
blue part gets knocked sideways far more than the rest — so blue reaches your
eyes from every direction at once.

- The same effect turns sunsets red: near the horizon light travels through
  much more air, and the blue is scattered away before it reaches you
- Violet scatters even more, but there's less of it and our eyes barely see it

→ umm why are sunsets red · umm why is the sea blue
```

No quotes. No ceremony. No `"..."` around your question.

## What it does

- **Just ask** — `umm how do i undo a git commit`. No quoting, no flags.
- **Fixes your spelling** — `umm photosinthisis` → answers _photosynthesis_, and
  tells you what else you might've meant.
- **Knows the word you forgot** — `umm the thing that turns dc into ac` → _inverter_.
- **Answers in a scannable shape** — a headline, the answer, a few details, and
  follow-up questions you can run next. Never a wall of chat.
- **Pipes cleanly** — `umm x | pbcopy` gets plain markdown, no color codes.

## 📦 Install

**With npm:**

```console
npm install -g @hexxt/umm     # or just: npx @hexxt/umm <question>
```

— or —

**Standalone binary** (macOS · Linux · Windows) — grab it from
[Releases](../../releases), or:

```console
brew install hexxt-git/tap/umm
```

First run drops you into a 10-second setup wizard. Re-run it any time with
`umm --config`.

## Usage

```console
umm <anything you want to know>

umm --config     # pick your agent, answer length, sources
umm --raw        # skip the pretty formatting (also automatic when piped)
```

Need punctuation the shell would eat (`?`, `'`, `|`)? Quote it:
`umm "what's the deal with sourdough?"`

## How it works

umm is really two things:

1. **A single skill** (`SKILL.md`) — the entire brain. It defines how a question
   becomes a clean, terminal-shaped answer.
2. **A tiny CLI** — it hands your question and that skill to whichever coding
   agent you've got (**Claude Code**, Cursor, Gemini, opencode, Codex…) and
   renders what comes back.

That's it. The CLI does no magic of its own — swap the agent, keep the behavior.

## Use it as a skill (no CLI)

The brain is portable. Drop it into any agent that speaks the
[Agent Skills](https://agentskills.io) standard:

```console
npx skills add hexxt-git/umm
```

---

Made for people who'd rather not Google. 🤔
