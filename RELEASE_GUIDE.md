# Release Automation Guide

Every vintasend package — the root `vintasend`, the implementations under
`src/implementations`, the tools under `src/tools` — is released at the **same
version**, from its **own repository**, by **GitHub Actions**.

Nothing is published from your machine. Pushing a `v<version>` tag to a
repository triggers its `.github/workflows/publish.yml`, which installs, tests,
builds and publishes to npm with OIDC trusted publishing.

## Quick Start

```bash
# 1. Bump every package.json (versions + internal dependency ranges)
npm run release:bump:alpha        # or :patch / :minor / :major / :promote

# 2. Write the release notes
$EDITOR CHANGELOG.md

# 3. Preview the whole release without touching anything
npm run release:tag -- --commit --dry-run

# 4. Run it: commit, push, tag and wait — one dependency wave at a time
npm run release:tag -- --commit
```

Step 4 is the whole release. It commits each repository, pushes it, pushes its
tag, waits for npm to serve the new version, and only then moves on to the
packages that depend on it.

---

## Step 1 — Bump versions (`npm run release:bump`)

```bash
npm run release:bump              # interactive
npm run release:bump:patch        # 1.0.0 → 1.0.1
npm run release:bump:minor        # 1.0.0 → 1.1.0
npm run release:bump:major        # 1.0.0 → 2.0.0
npm run release:bump:alpha        # 1.0.0 → 1.0.1-alpha1 (asks for the base bump)
npm run release:bump:alpha:major  # 1.0.0 → 2.0.0-alpha1
npm run release:bump:promote      # 1.0.0-alpha2 → 1.0.0
```

It starts from the **highest version anywhere in the workspace** and writes that
new version into every package.

What it touches:

- **Every package**, not just the implementations: the root package, everything
  under `src/implementations`, everything under `src/tools` (including the APIs
  and dashboards, which carry the version but publish nothing), and
  `vintasend-implementation-template` so newly scaffolded packages start on the
  current version.
- **Every internal dependency range**, in `dependencies`, `peerDependencies`,
  `devDependencies` and `optionalDependencies` — not only `vintasend`. That is
  what keeps `vintasend-managed-templates` inside
  `vintasend-medplum-template-manager`, or `vintasend-dashboard-core` inside
  `vintasend-dashboard`, moving with the release.
- **The operator is preserved**: `^1.0.0-alpha2` becomes `^1.0.1`, a pinned
  `1.0.0-alpha2` becomes `1.0.1`. A range that is not a plain version — a git
  URL, `file:`, `workspace:*` — is left alone and reported as a warning.

Useful flags: `--dry-run` (print the plan, write nothing), `--yes`,
`--bump=<type>`, `--alpha-base=patch|minor|major`.

Review before moving on:

```bash
git diff && git submodule foreach git diff
```

## Step 2 — CHANGELOG.md

Write the release notes by hand. They ride along in the root repository's
release commit in step 3.

## Step 3 — Commit, tag and wait (`npm run release:tag -- --commit`)

```bash
npm run release:tag -- --commit --dry-run   # print the plan, change nothing
npm run release:tag -- --commit             # do it
npm run release:tag                         # tags only: you committed and pushed yourself
```

For each dependency wave, in order:

1. `git add -A` and commit every repository in the wave
2. push the branch — **this is the step whose timing matters** (see below)
3. re-run the preflight checks against the commit that was just made
4. push `v<version>`, which starts `publish.yml`
5. poll npm until every package in the wave is live (watching the workflow run
   through the `gh` CLI, so a failed run fails fast instead of timing out)

Then, once every wave is published:

6. commit and push the repositories that carry the version but publish nothing
   (`vintasend-api`, `vintasend-dashboard`,
   `vintasend-templates-management-api`,
   `vintasend-templates-management-dashboard`)
7. commit and push the **submodule pointers** in the root repository

### Why the waves matter

Both `ci.yml` (on a branch push) and `publish.yml` (on a tag push) run
`npm install`. A repository pushed before its dependencies are on npm resolves a
version that does not exist yet, and the build fails every single time.

So nothing is pushed early. `vintasend` publishes first; only then is
`vintasend-pug` pushed; only then whatever depends on that. The script prints
the plan before it starts:

```
[3] Ordering packages into dependency waves...
  Wave 1: vintasend
  Wave 2: vintasend-managed-templates, vintasend-medplum, vintasend-pug, ...
    vintasend-pug waits for vintasend
  Wave 3: vintasend-medplum-template-manager, vintasend-templates-management-api
    vintasend-medplum-template-manager waits for vintasend, vintasend-managed-templates
  After every wave: vintasend-api, vintasend-dashboard, ...
```

After a wave is live the script pauses for `--settle` seconds (default 20)
before pushing the next one, because `npm view` answering is not quite the same
as every CDN edge serving the tarball.

### Why the root repository is committed twice

The root repository is two things at once: the `vintasend` package, and the
superproject that stores a pointer to every submodule.

Its release commit is made in wave 1, when the submodules have not been
committed yet — so that commit **deliberately excludes the submodule pointers**
(staging them would record pointers to pre-release commits). Every submodule
release commit then moves a pointer, and the final step of the run records all
of them in one `chore: update submodule pointers for v<version>` commit.

That is why the tag points at the first commit and `main` ends up one commit
ahead. The tag is what `publish.yml` checks out, and the pointers have no
bearing on what the `vintasend` package publishes.

For the same reason, moved submodule pointers never block a release: the
working-tree check runs with `--ignore-submodules=all`.

### Flags

| Flag | Effect |
| --- | --- |
| `--commit` | Commit and push each repository as its wave runs |
| `--commit-message=<msg>` | Message for those commits (default `Release <name>@<version>`) |
| `--dry-run` | Run every check, print the plan, change nothing |
| `--yes`, `-y` | Skip the confirmation prompt |
| `--only=a,b` / `--skip=a,b` | Select packages by npm name or directory name (`root` works for the root package) |
| `--no-verify` | Pass `--no-verify` to `git commit`, skipping the husky hooks |
| `--no-push-commit` | Commit but don't push (implies `--allow-unpushed`) |
| `--no-companions` | Don't commit/push the repositories that publish nothing |
| `--no-submodule-sync` | Skip the final submodule-pointer commit |
| `--timeout=<sec>` | How long to wait for npm (default 1800) |
| `--poll=<sec>` | Seconds between npm checks (default 15) |
| `--settle=<sec>` | Pause after a wave goes live (default 20) |
| `--no-watch` | Don't use the `gh` CLI to fail fast on failed workflow runs |
| `--allow-dirty` / `--allow-unpushed` | Relax the corresponding preflight check |
| `--registry=<url>` | Registry to poll (default `https://registry.npmjs.org/`) |

### Preflight

Before anything is written, every selected repository is checked for:

- a clean working tree (submodule pointers excluded)
- a committed `package.json` whose version matches the tag being pushed
- `HEAD` being an ancestor of the remote default branch
- no existing tag at the release version pointing somewhere else
- dependency ranges that the release can actually satisfy

Under `--commit`, the first three are reported as *pending* rather than fatal —
the commit step is about to resolve them — and re-checked for real after each
wave's commit, before its tag is pushed.

---

## Resuming an interrupted release

Re-run the same command. The script is idempotent:

- packages already on npm at the release version are skipped
- tags already pushed at the right commit are not re-pushed
- repositories with nothing to commit are left alone
- if everything is already published but commits are still outstanding, it says
  so and finishes them (including the submodule-pointer sync)

If a publish workflow fails, the run stops before the next wave — later waves
depend on it. Fix the workflow, then re-run.

## Troubleshooting

**`HEAD is not an ancestor of origin/main`**
The release commit is not on the remote default branch. Either you are on a
feature branch (merge it first) or you used `--no-push-commit`. Add
`--allow-unpushed` only if you know the tag push will carry the commit.

**`remote tag v… already points at …, not HEAD`**
That version has already been used for a different commit. Bump again rather
than moving a published tag.

**`workflow is waiting for approval on the "npm" environment`**
The repository's `npm` environment has required reviewers. Approve the run in
GitHub; the script keeps waiting.

**`gh CLI not found`**
Only affects fail-fast behaviour — the script falls back to polling npm until
the timeout.

**A dependency range warning during preflight**
Some package still points at the previous line. Re-run `release:bump` (it
rewrites every internal range) or fix the range by hand.

**The publish workflow fails on `npm ci` / lockfile sync**
Lockfiles are not touched by the release scripts. See the notes in
`scripts/README.md` and regenerate the lockfile from a clean install.

---

## Alpha versions

Alpha versions use the format `X.Y.Z-alphaN`. `publish.yml` derives the npm
dist-tag from the version, so `1.0.0-alpha2` publishes under `alpha`, not
`latest`.

```bash
npm run release:bump:alpha        # 1.0.0 → 1.0.1-alpha1 (asks for the base bump)
npm run release:bump              # then "increment alpha": 1.0.1-alpha1 → 1.0.1-alpha2
npm run release:bump:promote      # 1.0.1-alpha2 → 1.0.1
```

Comparison rules used to find the highest version:

- `0.4.15` > `0.4.15-alpha1` (stable beats its own alpha)
- `0.4.15-alpha2` > `0.4.15-alpha1`
- a `patch` bump from `0.4.15-alpha3` gives `0.4.16`; a `minor` bump gives `0.5.0`

Installing them:

```bash
npm install vintasend@alpha
npm install vintasend@1.0.1-alpha1
```

---

## Post-release checklist

- [ ] Draft the GitHub releases for the new tags
- [ ] `npm view vintasend versions` — spot-check a few packages
- [ ] Confirm each repository's `main` is green in CI
- [ ] Announce the release

## The scripts

| Script | Role |
| --- | --- |
| `scripts/release-bump.js` | Step 1 — versions and internal dependency ranges |
| `scripts/release-tag.js` | Step 3 — commit, push, tag, wait, wave by wave |
| `scripts/utils/workspace-packages.js` | Shared package discovery, dependency graph and wave ordering |
| `scripts/utils/version-bumper.js` | Version arithmetic |
| `scripts/utils/package-updater.js` | package.json rewriting |

`scripts/release.js` and `scripts/release-publish.js` are the older flow that
published from a developer machine with npm 2FA. They are kept for emergencies;
the GitHub Actions flow above is the supported path.

See [scripts/README.md](scripts/README.md) for the other scripts in this
directory.
