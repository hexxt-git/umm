# CLAUDE.md

## What umm is

A CLI that answers a question in a compact, terminal-shaped way instead of
conversational prose. It does almost nothing itself: it hands the question plus
a skill (a big prompt) to whichever coding agent the user configured, then
renders the markdown that comes back. **The product is the skill, not the code.**

## The two markdown files are the real source of truth

- **`SKILL.md`** (repo root) — the portable "brain". Defines the entire output
  shape and behavior. It is validated prompt content: reword it deliberately,
  not casually, and re-test against real queries after changing it. Root
  placement is intentional — it makes the repo installable as a standalone
  agent skill (`npx skills add <owner>/umm`).
- **`cli.md`** — a CLI-only addendum bolted on at prompt-build time. It tells the
  agent it has no edit permissions and to redirect the user (usually: run the
  agent directly instead of through umm). It is deliberately **not** part of the
  standalone skill, so a `npx skills` install never sees it.

Both are **excluded from Prettier** (`.prettierignore`) because their exact
wording/whitespace is functional.

## Build model: the skill is embedded, not read at runtime

`scripts/embed-skill.ts` reads `SKILL.md` + `cli.md`, strips frontmatter, and
writes `src/skill.generated.ts` (exports `SKILL`, `CLI_ADDENDUM`).

- `src/skill.generated.ts` is **generated and gitignored**. A fresh clone must
  run `npm run build:skill` (or `build` / `typecheck`, which do it) before the
  CLI will run.
- Editing `SKILL.md`/`cli.md` requires a rebuild to take effect.

## Imports use `.js`, but the source is `.ts`

Relative imports are written with `.js` specifiers (`./agents.js`) even though
the files are `.ts`. This is the tsc ESM convention (tsc resolves `.js` → `.ts`
source and emits real `.js`). Consequence:

- **`node src/index.ts` does NOT work** (Node won't rewrite `.js` → `.ts`).
- Dev runs through **Bun**: `bun src/index.ts <question>` (or `npm run dev`).
- npm ships the compiled `dist-npm/`, not the source.

## Commands

- `npm run dev -- <question>` — run from source via Bun.
- `npm run build` — embed skill, `tsc -p tsconfig.build.json` → `dist-npm/` (ESM,
  ES2019, Node ≥14), then `postbuild.ts` (shebang + chmod + copy README).
- `npm run build:binaries` — Bun `--compile` cross-platform binaries into
  `dist-bin/`. **Bun is required only here.** Binaries are ~60MB (embedded
  runtime; that's the floor).
- `npm run typecheck` / `npm run format`.

Node ≥14 for the published package; local dev/typecheck wants Node ≥22.18 (or
Bun) to run the `.ts` scripts directly.

## Distribution is dual

- **npm** carries portable compiled ESM (`dist-npm/`, Node ≥14). `bin` →
  `dist-npm/index.js`.
- **Bun binaries** (`dist-bin/`) for brew/direct download, built from the same
  source.

## Releasing (Changesets → npm + GitHub Release + Homebrew)

Releases are automated; **never bump the version or publish by hand.** `main` is
protected and squash-only, which the flow is built around.

- **Per PR:** run `npx changeset` and commit the generated `.changeset/*.md`
  (bump + one-line summary → changelog + release note). Chores with no user
  impact need none.
- **`.github/workflows/release.yml`** (push to `main`) runs `changesets/action`:
  with pending changesets it opens/updates the **"release: version packages"**
  PR (bumps `package.json`, writes `CHANGELOG.md`); squash-merging that PR runs
  `npm run release` (`changeset publish`) → npm publish, then the workflow builds
  `dist-bin/` binaries, cuts a **`v<version>`** GitHub Release with them attached,
  and regenerates `Formula/umm.rb` in `hexxt-git/homebrew-tap` via
  `scripts/render-formula.sh` (version + fresh sha256s).
- **Tag convention is `v<version>`** (matches the brew URLs); we set
  `createGithubReleases: false` so changesets' scoped `@hexxt/umm@x` tag doesn't
  become the release.
- **`.github/workflows/ci.yml`** runs `format:check` + `typecheck` on PRs.
- **Secrets/settings** (repo): `NPM_TOKEN` (npm automation token, publish rights
  on `@hexxt`), `HOMEBREW_TAP_TOKEN` (PAT with contents:write on
  `homebrew-tap`), and Settings → Actions → "Allow GitHub Actions to create and
  approve pull requests" enabled.

## Architecture (src/)

- `index.ts` — entry + arg parsing. **Rule: only `argv[0]` may be a flag**, so
  `umm what does --force do` passes through verbatim. Flags: `--config` /
  `config`, `--raw`. No `--agent` flag (agent comes only from config).
- `agents.ts` — adapter table **as data**. Each agent has an `input` mode:
  `"stdin"` (claude, cursor, codex) or `"arg"` (antigravity/`agy`, opencode).
  Verified: claude, antigravity, opencode. **Unverified guesses: cursor, codex**
  — and each agent's web-access flag matters (wrong flag ⇒ silent stale answers).
- `run.ts` — builds `SKILL + CLI_ADDENDUM + config + query`, spawns the agent,
  returns stdout. **No fallback by design**: if the agent fails, surface and exit.
- `config.ts` — JSON at `$XDG_CONFIG_HOME/umm/config.json` (`~/.config/umm/…`).
  Injected into the prompt as a `## Configuration` block (length, sources).
- `wizard.ts` — dependency-free raw-mode TTY select for `umm --config` / first run.
- `spinner.ts` — stderr-only elapsed spinner (agents buffer until done).
- `render/` — hand-rolled markdown → terminal, **no deps**, full markdown minus
  HTML. `width.ts` is display-width-aware (counts columns, ignores ANSI, handles
  wide/zero-width) — the wrapping correctness depends on it, don't naïvely use
  `.length`. Color only on a TTY; piped/redirected/`--raw` emits clean markdown.

## Conventions

- Pre-commit (Husky) runs `npm run precommit` → lint-staged → Prettier. Tooling
  is npm-based; only `build:binaries` uses Bun.
- Keep the agent adapter table honest: mark flags you haven't actually tested.
