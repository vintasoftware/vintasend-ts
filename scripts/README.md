# Release Automation Scripts

This directory contains automation scripts for releasing new versions of vintasend-ts and its implementation packages.

## Scripts

### `generate-implementation.js`
Creates a new implementation package from `vintasend-implementation-template`.

What it does:
- Copies the template to a new directory under `src/implementations`, skipping
  local artifacts (`node_modules`, `coverage`, `dist`, `package-lock.json`,
  `.DS_Store`, `Thumbs.db`)
- Updates the new package `name`, `description` and `repository` in `package.json`
  (`repository` points at `github.com/<repo>`, with no `directory`)
- Fills in the `Repository:` line in `.github/workflows/publish.yml` with the
  same repository, for registering the npm trusted publisher
- Keeps only selected components (backend, attachment-manager, adapter, template-renderer, logger)
- Deletes unused component source and test files
- Rewrites `src/index.ts` exports to match selected components (with `.js`
  extensions, as required by `moduleResolution: NodeNext`)
- Replaces `README.md` with a concise package-specific version

Usage:
```bash
npm run implementation:generate -- --dir=vintasend-aws-ses --package=@acme/vintasend-aws-ses --components=backend,adapter,template-renderer
```

Optional flags:
- `--repo=<owner>/<name>` (or just `--repo=<name>`) to set the GitHub repository;
  defaults to `vintasoftware/<dir>`
- `--force` to overwrite an existing target directory
- `--help` to show all options

Interactive mode:
- If `--dir`, `--package`, or `--components` are not passed, the script prompts for missing values.
- If the target directory already exists and `--force` is not passed, it prompts for overwrite confirmation.

### `release-bump.js`
Release step 1: puts every package in the workspace on one new version.

What it does:
- Discovers **every** package — the root `vintasend`, everything under
  `src/implementations`, everything under `src/tools` (including the two
  dashboard apps that carry the version but publish nothing), and
  `vintasend-implementation-template`
- Starts from the highest version found anywhere and applies the chosen bump
- Writes that version into every `package.json`
- Rewrites **every** dependency on another workspace package — in
  `dependencies`, `peerDependencies`, `devDependencies` and
  `optionalDependencies`, not just `vintasend` — preserving the operator, so
  `^1.0.0-alpha2` becomes `^1.0.1` and a pinned `1.0.0-alpha2` becomes `1.0.1`
- Leaves ranges it cannot rewrite (git URLs, `file:`, `workspace:*`) alone and
  warns about them
- Saves `.release-state.json`

```bash
npm run release:bump        # interactive
npm run release:bump:patch  # and :minor / :major / :alpha / :alpha:major / :promote
```

Useful flags: `--dry-run`, `--yes`, `--bump=<type>`,
`--alpha-base=patch|minor|major`.

### `release-tag.js`
Release step 3: publishes through GitHub Actions instead of from your machine,
by pushing the tags that trigger each repository's `publish.yml`.

What it does:
- Finds every package that has its own `.github/workflows/publish.yml` **and** is
  the root of its own git repository (so `vintasend-implementation-template`,
  which lives inside this repo, is excluded)
- Groups them into waves: `vintasend` first, then everything depending only on
  `vintasend`, then packages depending on those, and so on
- Preflights each repo — clean tree, HEAD merged into the remote default branch,
  committed `package.json` version matching the tag, no conflicting existing tag
- For each wave in turn: commits and pushes the repositories (with `--commit`),
  pushes `v<version>`, then waits for npm to serve that version before starting
  the next wave
- Uses the `gh` CLI, when available, to fail fast if a publish workflow fails
  rather than waiting out the timeout

The wave ordering is the point. Both `ci.yml` (branch push) and `publish.yml`
(tag push) run `npm install`, so a repository pushed before its dependencies are
on npm resolves a version that does not exist yet and fails every time.

With `--commit` it also makes the release commits, and handles the two
repositories that don't fit the simple pattern:

- The **root repository** is both the `vintasend` package and the superproject.
  Its release commit excludes the submodule pointers — at that moment the
  submodules have not been committed yet — and a final
  `chore: update submodule pointers for v<version>` commit records them once
  every submodule is done. Moved pointers never block the release either: the
  working-tree check runs with `--ignore-submodules=all`.
- The **APIs and dashboards** under `src/tools` have no `publish.yml`. They are
  committed and pushed after every published package is live, and never tagged.

Without `--commit` it behaves as before: it pushes nothing but tags, and expects
the release commits to be merged already. Either way it is safe to re-run —
published packages, pushed tags and clean repositories are all skipped, so an
interrupted release resumes where it stopped.

```bash
npm run release:tag -- --commit --dry-run   # print the whole plan, change nothing
npm run release:tag -- --commit             # commit, push, tag and wait
npm run release:tag                         # tags only
```

Useful flags: `--commit`, `--commit-message=`, `--no-verify`, `--only=`,
`--skip=`, `--timeout=<sec>`, `--poll=<sec>`, `--settle=<sec>`, `--no-watch`,
`--no-companions`, `--no-submodule-sync`, `--allow-dirty`, `--allow-unpushed`,
`--yes`. Run with `--help` for the full list.

### `release.js` / `release-publish.js`
The older flow that published from a developer machine with npm 2FA. Kept for
emergencies; the GitHub Actions flow above is the supported path. See
[RELEASE_GUIDE.md](../RELEASE_GUIDE.md).

### `check-all-local.js`
Runs the whole check suite across every package with all cross-package
dependencies pointed at local sources.

What it does:
- Temporarily rewrites every dependency on another package in this repo to a
  `file:` spec (including implementation-to-implementation dependencies, e.g.
  `vintasend-medplum-template-manager` → `vintasend-managed-templates`)
- Visits packages in dependency order, building each one before its dependents
  so `tsc` can resolve types from the dependency's freshly built `dist/`
- Runs `build`, `lint`, `format`, `typecheck` and `test` in each package,
  preferring the package's own npm script and falling back to
  `biome`/`prettier`/`tsc` where a script is missing
- Keeps going after a failure and prints a pass/fail matrix at the end
- Always restores the rewritten `package.json` files — on success, on failure,
  and on Ctrl-C

`format` runs in report-only mode by default, because every `format` script in
this repo rewrites files (`biome check --write`, or `prettier --write` in the
dashboards). Report-only uses the package's `format:check` script when it has
one, else `biome format .` / `prettier --check .`. Pass `--fix` to run the
package's own `format` script and let it write.

```bash
npm run check:local        # check everything, report formatting problems
npm run check:local:fix    # same, but let format rewrite files
```

Useful flags: `--only=`, `--skip=`, `--checks=build,lint,format,typecheck,test`,
`--bail`, `--no-install`, `--verbose`, `--include-template`, `--keep-links`.
Run with `--help` for the full list.

Compared to `test-implementations-local.js`, which runs a single npm script
against a locally linked `vintasend`, this covers the whole dependency graph and
every check in one pass.

### Utilities (`utils/`)
- **workspace-packages.js**: Discovers every package in the workspace and builds
  the dependency graph and release waves. Shared by the bump and tag steps so
  the two can't disagree about what the workspace contains — which is how
  `src/tools/*` used to get released without ever being version-bumped.
- **version-finder.js**: Version comparison (`compareVersions`)
- **version-bumper.js**: Handles version bumping logic
- **package-updater.js**: Updates package.json versions and dependency ranges
- **publisher.js**: npm publishing and testing (legacy flow)
- **git-handler.js**: git operations (legacy flow)

## Releasing

The full walkthrough lives in [RELEASE_GUIDE.md](../RELEASE_GUIDE.md); the short
version is three steps:

```bash
# 1. Bump every package.json in the workspace
npm run release:bump              # interactive
npm run release:bump:patch        # 1.0.0 → 1.0.1
npm run release:bump:minor        # 1.0.0 → 1.1.0
npm run release:bump:major        # 1.0.0 → 2.0.0
npm run release:bump:alpha        # 1.0.0 → 1.0.1-alpha1 (prompts for the base bump)
npm run release:bump:alpha:major  # 1.0.0 → 2.0.0-alpha1
npm run release:bump:promote      # 1.0.0-alpha2 → 1.0.0

# 2. Write the release notes in CHANGELOG.md, then review
git diff && git submodule foreach git diff

# 3. Commit, push, tag and wait — one dependency wave at a time
npm run release:tag -- --commit --dry-run
npm run release:tag -- --commit
```

The alpha base bump type can also be preset on any alpha bump with
`--alpha-base=patch|minor|major`, which skips that prompt.

Nothing is published locally. Pushing `v<version>` to a repository triggers its
`publish.yml`, which installs, tests, builds and publishes to npm with OIDC
trusted publishing — no `NPM_TOKEN`, no 2FA prompt on your machine.

### Notes

- `vintasend-implementation-template` is never released: it lives inside this
  repository, so GitHub never runs the `publish.yml` it carries for scaffolding.
  It is still version-bumped, so packages generated from it start current.
- The APIs and dashboards under `src/tools` have no `publish.yml`. They are
  bumped, committed and pushed, but never tagged or published.
- Lockfiles are not touched by the release scripts. If a publish workflow fails
  on `npm ci` being out of sync, regenerate the lockfile from a clean install
  and commit it before releasing.
