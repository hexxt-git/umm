# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
It drives versioning, the `CHANGELOG.md`, npm publishes, GitHub Releases, and the
Homebrew formula — see `.github/workflows/release.yml`.

## Adding a changeset

Every user-facing change should ship with a changeset. In your feature branch:

```sh
npx changeset
```

Pick the bump (`patch` / `minor` / `major`) and write a one-line summary — that
line becomes the changelog entry and the GitHub Release note. Commit the
generated `.changeset/*.md` file with your PR.

Chores with no user impact (CI, formatting, internal docs) need no changeset.

## How a release happens

1. PRs land on `main` carrying changeset files.
2. CI opens/updates a **"release: version packages"** PR that consumes the
   changesets, bumps `package.json`, and updates `CHANGELOG.md`.
3. Squash-merging that PR publishes to npm, cuts a `v<version>` GitHub Release
   with the `dist-bin/` binaries attached, and bumps the Homebrew formula in
   `hexxt-git/homebrew-tap`.

You never run `changeset version`/`publish` by hand — the workflow does.
