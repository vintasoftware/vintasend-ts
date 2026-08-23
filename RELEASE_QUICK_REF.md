# VintaSend Release - Quick Reference

Full details: [RELEASE_GUIDE.md](RELEASE_GUIDE.md)

## The three steps

```bash
# 1. Bump every package.json in the workspace
npm run release:bump:alpha        # or :patch / :minor / :major / :promote

# 2. Write the release notes
$EDITOR CHANGELOG.md

# 3. Commit, push, tag and wait — one dependency wave at a time
npm run release:tag -- --commit --dry-run   # preview first
npm run release:tag -- --commit
```

Nothing is published from your machine: pushing `v<version>` triggers each
repository's `publish.yml`, which publishes to npm through GitHub Actions.

## What happens

**Step 1 — `release-bump.js`**
1. ✓ Finds the highest version anywhere in the workspace
2. ✓ Writes the new version into **every** package: root, `src/implementations/*`, `src/tools/*`, the template
3. ✓ Rewrites **every** internal dependency range (not just `vintasend`), keeping `^` / `~` / pinned as it found it
4. ✓ Saves `.release-state.json`

**Step 3 — `release-tag.js --commit`**, per dependency wave:
1. ✓ Commits every repository in the wave
2. ✓ Pushes the branch — only now, because everything it depends on is already on npm
3. ✓ Re-runs preflight against the new commit
4. ✓ Pushes `v<version>` and waits for npm (watching the run via `gh`)

Then, once every wave is live:

5. ✓ Commits and pushes the repos that carry the version but publish nothing (APIs, dashboards)
6. ✓ Commits and pushes the submodule pointers in the root repo

## Why the order matters

`ci.yml` and `publish.yml` both run `npm install`. Push a repository before its
dependencies are on npm and the build fails every time — so nothing is pushed
early.

## Two commits in the root repo

The root repo is both the `vintasend` package and the superproject. Its release
commit (wave 1) excludes the submodule pointers, because the submodules have not
been committed yet; a final `chore: update submodule pointers…` commit records
them. The tag stays on the release commit.

## Handy flags

| Flag | Effect |
| --- | --- |
| `--dry-run` | Print the plan, change nothing |
| `--yes` | No confirmation prompt |
| `--only=a,b` / `--skip=a,b` | Pick packages (`root` = the root package) |
| `--no-verify` | Skip husky hooks on the release commits |
| `--settle=<sec>` | Pause after a wave goes live (default 20) |
| `--timeout=<sec>` / `--poll=<sec>` | npm wait tuning |

## Safety

- Re-running is safe: published packages, pushed tags and clean repos are skipped
- Preflight blocks on a mismatched or already-used tag before anything is written
- A failed publish workflow stops the run before the next wave

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `HEAD is not an ancestor of origin/main` | Merge the release branch, or use `--allow-unpushed` knowingly |
| `remote tag v… points at …, not HEAD` | That version is taken — bump again |
| `workflow is waiting for approval` | Approve the `npm` environment run in GitHub |
| `gh CLI not found` | Only disables fail-fast; polling still works |
| Dependency range warning | Re-run `release:bump`, or fix the range by hand |

---

**First time?** Run `npm run release:tag -- --commit --dry-run` to see the whole
plan without changing anything.
