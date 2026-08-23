# Release Automation Scripts

This directory contains automation scripts for releasing new versions of vintasend-ts and its implementation packages.

## Scripts

### `generate-implementation.js`
Creates a new implementation package from `vintasend-implementation-template`.

What it does:
- Copies the template to a new directory under `src/implementations`
- Updates the new package `name` in `package.json`
- Keeps only selected components (backend, attachment-manager, adapter, template-renderer, logger)
- Deletes unused component source and test files
- Rewrites `src/index.ts` exports to match selected components
- Replaces `README.md` with a concise package-specific version

Usage:
```bash
npm run implementation:generate -- --dir=vintasend-aws-ses --package=@acme/vintasend-aws-ses --components=backend,adapter,template-renderer
```

Optional flags:
- `--force` to overwrite an existing target directory
- `--help` to show all options

Interactive mode:
- If `--dir`, `--package`, or `--components` are not passed, the script prompts for missing values.
- If the target directory already exists and `--force` is not passed, it prompts for overwrite confirmation.

### `release.js`
Main orchestration script that handles the entire release process.

### `release-tag.js`
Publishes through GitHub Actions instead of from your machine. Pushes the git
tags that trigger each repository's `publish.yml`, in dependency order.

What it does:
- Finds every package that has its own `.github/workflows/publish.yml` **and** is
  the root of its own git repository (so `vintasend-implementation-template`,
  which lives inside this repo, is excluded)
- Groups them into waves: `vintasend` first, then everything depending only on
  `vintasend`, then packages depending on those, and so on
- Preflights each repo — clean tree, HEAD merged into the remote default branch,
  committed `package.json` version matching the tag, no conflicting existing tag
- Pushes `v<version>` for each package in a wave, then waits for npm to serve
  that version before starting the next wave
- Uses the `gh` CLI, when available, to fail fast if a publish workflow fails
  rather than waiting out the timeout

It never commits, branches or pushes anything except tags: the release commits
are expected to be merged already. It is safe to re-run — packages already
published at the release version are skipped, so an interrupted release resumes.

```bash
npm run release:tag:dry    # preflight everything, print the plan, push nothing
npm run release:tag        # push tags and wait, wave by wave
```

Useful flags: `--only=`, `--skip=`, `--timeout=<sec>`, `--poll=<sec>`,
`--no-watch`, `--allow-dirty`, `--allow-unpushed`, `--yes`. Run with `--help`
for the full list.

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
- **version-finder.js**: Finds the highest version among implementation packages
- **version-bumper.js**: Handles version bumping logic
- **package-updater.js**: Updates package.json files
- **publisher.js**: Handles npm publishing and testing
- **git-handler.js**: Manages git operations (staging, committing)

## Usage

### Interactive Release (Recommended)
```bash
npm run release
```

This will:
1. Check git status (must be clean)
2. Find the highest version among implementations
3. Prompt for version bump type (patch, minor, major or alpha — alpha also asks for its base bump: patch, minor or major)
4. Prompt for commit messages (separate for main and implementations)
5. Show summary and ask for confirmation
6. Update and publish main package (opens browser for 2FA)
7. Wait for 2FA authorization (valid for 5 minutes)
8. Update and publish all implementation packages
9. Commit changes (implementations first, then main package)

### Dry Run (Test Without Changes)
```bash
npm run release:dry-run
```

Shows exactly what would happen without making any actual changes. Great for testing the process.

### Direct Release with Preset Bump Type
```bash
# Patch release (e.g., 0.4.14 → 0.4.15)
npm run release:patch

# Minor release (e.g., 0.4.14 → 0.5.0)
npm run release:minor
```

### Version Bump with Preset Type (`release:bump`)
```bash
# Patch bump (e.g., 0.4.14 → 0.4.15)
npm run release:bump:patch

# Minor bump (e.g., 0.4.14 → 0.5.0)
npm run release:bump:minor

# Major bump (e.g., 0.4.14 → 1.0.0)
npm run release:bump:major

# Alpha bump — prompts for the base bump type (e.g., 0.4.14 → 0.4.15-alpha1)
npm run release:bump:alpha

# Alpha of a major bump (e.g., 0.4.14 → 1.0.0-alpha1)
npm run release:bump:alpha:major

# Promote the current alpha to stable (e.g., 1.0.0-alpha2 → 1.0.0)
npm run release:bump:promote
```

The alpha base bump type can also be preset on any alpha bump with
`--alpha-base=patch|minor|major`, which skips that prompt.

## Release Process

The script follows this sequence:

1. **Git Status Check**: Ensures working directory is clean
2. **Version Detection**: Finds highest version among implementations
3. **Version Calculation**: Bumps version based on user selection
4. **User Confirmation**: Shows summary and asks for confirmation
5. **Main Package**:
   - Updates version in package.json
   - Runs tests
   - Builds package
   - Publishes to npm (opens browser for 2FA)
   - Waits for user to confirm authorization
6. **Implementation Packages**:
   - Updates vintasend dependency version
   - Updates package version to match main package
7. **Build & Publish Implementations**:
   - Tests each package
   - Builds each package
   - Publishes to npm (within 5-minute 2FA window)
8. **Git Commits**:
   - First: Commits all implementation package.json changes (custom message)
   - Second: Commits main package.json changes (custom message)

## Safety Features

- ✅ **Dry run mode**: Test without making changes
- ✅ **Git status check**: Prevents releases with uncommitted changes
- ✅ **2FA support**: Pauses for browser authorization, then uses 5-minute window
- ✅ **Separate commit messages**: Different messages for main and implementations
- ✅ **User confirmation**: Shows summary before proceeding
- ✅ **Test before publish**: Runs tests for each package
- ✅ **Error handling**: Catches and reports errors
- ✅ **Colored output**: Clear visual feedback

## Post-Release Steps

After the automation completes:

1. **Update CHANGELOG.md** (manual step)
2. **Review commits**: Check the two commits created
3. **Push to remote**:
   ```bash
   git push
   ```

## Troubleshooting

### "Working directory is not clean"
Commit or stash your changes before running the release script.

### "Tests failed"
The script will skip publishing packages that fail tests. Fix the tests and run the release again.

### "Failed to publish"
- Check you're logged in to npm: `npm whoami`
- Check you have publish rights to the packages
- Verify the version doesn't already exist on npm

### Publishing Issues
If the script fails mid-publish:
- Main package might be published but not implementations (or vice versa)
- Check npm to see which packages were published
- You may need to manually publish remaining packages
- The git commits are only made after all publishing succeeds

## Examples

### Example: Patch Release

```bash
$ npm run release:patch

========================================
  VintaSend Release Automation
========================================

[1] Checking git status...
✓ Working directory is clean

[2] Finding highest implementation version...
ℹ Highest version: 0.4.14 (vintasend-medplum)

[3] Determining version bump type...
ℹ New version will be: 0.4.15 (patch bump)

[4] Getting commit message...
Commit message (press Enter for "Bump versions"):

ℹ Commit message: "Bump versions"

==================================================
RELEASE SUMMARY
==================================================
New version:      0.4.15
Bump type:        patch
Commit message:   "Bump versions"
==================================================

Proceed with release? (yes/no): yes

[6] Updating main package version...
✓ Updated vintasend package.json to 0.4.15

...
```

## Notes

- The script excludes `vintasend-implementation-template` from releases
- All implementations will be bumped to match the main package version
- Both `dependencies` and `peerDependencies` are updated for vintasend
- Each implementation is published independently
