# Release Automation Scripts

This directory contains automation scripts for releasing new versions of vintasend-ts and its implementation packages.

## Scripts

### `release.js`
Main orchestration script that handles the entire release process.

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
3. Prompt for version bump type (patch or minor)
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
