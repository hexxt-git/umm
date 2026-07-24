# Contributing to umm

Thanks for helping out. umm is small on purpose — **the product is the skill
(`SKILL.md`), not the code** — so contributions are held to a simple bar: focused,
reviewable, and released cleanly. Please read this before opening a PR.

## The three rules that matter most

1. **Every user-facing change ships with a changeset.** No changeset, no
   release — the version never moves and nothing publishes.
2. **One PR = one concern.** Structured, self-contained, easy to review.
3. **Touch as little unrelated code as possible.** A focused diff gets merged;
   a sprawling one gets sent back.

Everything below expands on these.

## 1. Changesets are required

Releases are fully automated by [Changesets](https://github.com/changesets/changesets)
(see the "Releasing" section of `CLAUDE.md`). Your PR feeds that pipeline.

For any change users would notice — behavior, output, a new agent adapter, a
`SKILL.md` reword, a bug fix — add one in your branch:

```sh
npx changeset
```

- Pick the bump: **patch** (fix), **minor** (feature, backwards-compatible),
  **major** (breaking).
- Write a **one-line, user-facing summary**. It becomes the `CHANGELOG.md` entry
  and the GitHub Release note, so write it for a reader, not for yourself:
  _"Add codex agent adapter"_, not _"update agents.ts"_.
- **Commit the generated `.changeset/*.md` file** with your PR.

**When you don't need one:** pure chores with zero user impact — CI, formatting,
internal comments, test-only changes. When in doubt, add one; an unnecessary
patch bump is cheaper than a missed changelog entry.

Do **not** bump the version in `package.json` or edit `CHANGELOG.md` by hand —
the release workflow owns both.

## 2. Structured PRs

- **Scope:** one logical change per PR. Split unrelated work into separate PRs.
- **Title:** short and conventional — `feat: …`, `fix: …`, `docs: …`, `chore: …`,
  `refactor: …`.
- **Description:** say _what_ changed and _why_. If behavior or output changed,
  show a before/after (a pasted terminal snippet is perfect for umm).
- **Green CI:** `format:check` and `typecheck` must pass (they run automatically).
- **`main` is protected and squash-only.** Land work through PRs; keep your
  branch history tidy since it collapses into one commit on merge.

## 3. Keep the diff minimal and on-topic

The fastest way to a merge is a diff a reviewer can hold in their head.

- **Don't reformat or rename unrelated code.** Prettier runs on staged files
  via a pre-commit hook; let it handle formatting and don't sweep through files
  your change doesn't touch.
- **No drive-by refactors.** Spot something worth improving nearby? Open a
  separate issue or PR for it.
- **No unrelated dependency bumps** or config churn riding along.
- Match the **style and altitude of the surrounding code** — comment density,
  naming, idioms. New code should read like it was always there.

If a change genuinely requires touching many files, say so in the PR description
and, where you can, split the mechanical part from the meaningful part.

## Local development

Tooling is **npm-based**; Bun is only needed to compile the standalone binaries.

```sh
npm install
npm run dev -- "your question here"   # run from source via Bun
npm run typecheck                     # embeds the skill + tsc --noEmit
npm run format                        # prettier --write .
```

Node **≥22.18** (or Bun) is needed locally to run the `.ts` build scripts
directly. See `CLAUDE.md` for the full build model and architecture.

### Editing the skill

`SKILL.md` and `cli.md` are **validated prompt content**, not prose — reword them
deliberately and re-test against real queries afterward. They're intentionally
excluded from Prettier (their whitespace is functional), and they're embedded at
build time, so a change only takes effect after a rebuild
(`npm run build:skill`). A change to either almost always warrants a changeset.

## Checklist before you open a PR

- [ ] Change is focused on one concern.
- [ ] Unrelated code left untouched (no stray reformatting/renames).
- [ ] `npx changeset` added and committed (or the change is a genuine no-impact chore).
- [ ] `npm run typecheck` and `npm run format:check` pass.
- [ ] PR title is conventional; description explains what and why (before/after if output changed).
