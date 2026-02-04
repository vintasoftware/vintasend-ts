# Release Automation Guide

## Quick Start

The release process is split into two steps:

**Step 1: Bump Versions**
```bash
# Interactive (prompts for patch/minor/alpha)
npm run release:bump

# Direct bump type
npm run release:bump:patch   # 0.4.14 → 0.4.15
npm run release:bump:minor   # 0.4.14 → 0.5.0
npm run release:bump:alpha   # 0.4.14 → 0.4.15-alpha1 (prompts for base bump type)
```

**Step 2: Update CHANGELOG.md**
Manually update the changelog with release notes.

**Step 3: Publish**
```bash
npm run release:publish
```

## Two-Step Release Process

### Why Two Steps?

1. **Bump versions** - Updates all package.json files
2. **Manual CHANGELOG update** - You write release notes
3. **Commit and publish** - Each package gets its own commit message

This gives you full control over release notes and commit messages.

## Alpha Versions

Alpha versions allow you to release experimental or unstable versions for testing before a stable release. The system supports alpha versions with the format `X.Y.Z-alphaN` where N is the iteration number.

### When to Use Alpha Versions

- Testing new features before stable release
- Getting early feedback from users
- Fixing bugs in pre-release versions without affecting stable releases
- Testing breaking changes

### Creating Alpha Versions

```bash
# Interactive mode
npm run release:bump
# Then select option 3 for alpha
# Select base bump type: patch or minor
# Enter alpha iteration number (default: 1)

# Example progression:
0.4.14 → 0.4.15-alpha1 → 0.4.15-alpha2 → 0.4.15 (stable)

# Or with minor bump:
0.4.14 → 0.5.0-alpha1 → 0.5.0-alpha2 → 0.5.0 (stable)
```

### Incrementing Alpha Versions

If your current version is already an alpha (e.g., `0.5.0-alpha1`), you'll see an additional option to just increment the alpha iteration:

```bash
npm run release:bump

Select version bump type:
  1) patch (e.g., 0.5.0-alpha1 → 0.5.1)
  2) minor (e.g., 0.5.0-alpha1 → 0.6.0)
  3) alpha (e.g., 0.5.0-alpha1 → 0.5.1-alpha1)
  4) increment alpha (e.g., 0.5.0-alpha1 → 0.5.0-alpha2)

# Choosing option 4 will bump: 0.5.0-alpha1 → 0.5.0-alpha2
```

This is useful when you want to release multiple alpha iterations of the same version for testing and bug fixes.

### How Alpha Versions Are Compared

The version comparison correctly handles alpha versions:
- `0.4.15` > `0.4.15-alpha1` (stable is newer than alpha)
- `0.4.15-alpha2` > `0.4.15-alpha1` (higher alpha iteration is newer)
- `0.4.14` < `0.4.15-alpha1` (older stable version is less than newer alpha)
- When bumping from `0.4.15-alpha3` with a patch bump → `0.4.16`
- When bumping from `0.4.15-alpha3` with a minor bump → `0.5.0`

### Publishing Alpha Versions

Alpha versions publish normally to npm but won't be installed by default:

```bash
# Users must explicitly request alpha versions
npm install vintasend@0.4.15-alpha1

# Or use a tag
npm install vintasend@alpha
```

To set the `@alpha` tag in npm (requires npm publish with `--tag=alpha`):

```bash
# This requires manual setup; the automated release uses default tags
npm publish --tag alpha
```

## What Gets Automated

### Step 1: Version Bump (`npm run release:bump`)
✅ **Version Detection**: Finds the highest version among all implementations (supports stable and alpha versions)  
✅ **Version Bumping**: Updates main package and all implementations to the same new version (patch, minor, or alpha)  
✅ **Dependency Updates**: Updates `vintasend` dependency in all implementations  
✅ **State Saving**: Saves release state for step 2

### Step 2: Publish (`npm run release:publish`)
✅ **Individual Commit Messages**: Each package (main + implementations) gets its own commit message  
✅ **Testing**: Runs tests for main package and all implementations  
✅ **Building**: Builds all packages before publishing  
✅ **Publishing**: Publishes to npm (main package first, then implementations)  
✅ **Git Commits**: Creates separate commits for each package  

## What You Do Manually

📝 **Update CHANGELOG.md**: Between step 1 and step 2  
📝 **Review changes**: `git diff` after step 1  
📝 **Custom commit messages**: For each package during step 2  
📝 **Push to remote**: `git push` after step 2  

## How It Works

### The Process

1. **Pre-flight Checks**
   - Verifies git working directory is clean
   - Finds highest version among implementations (currently `vintasend-medplum@0.4.14`)

2. **User Input**
   - Choose bump type: `patch` or `minor`
   - Provide commit message for main package (default: "Bump main package version")
   - Provide commit message for implementations (default: "Bump implementation versions")
   - Confirm before proceeding

3. **Main Package Release**
   ```
   vintasend:
   - Update version in package.json
   - Run tests
   - Build package (npm run build)
   - Publish to npm (opens browser for 2FA authorization)
   - Wait for user to authorize in browser
   - Authorization valid for 5 minutes for subsequent publishes
   ```

4. **Update All Implementations**
   ```
   For each implementation:
   - Update vintasend dependency to ^{newVersion}
   - Update package version to {newVersion}
   ```

5. **Publish All Implementations**
   ```
   For each implementation:
   - Run tests
   - Build package
   - Publish to npm
   ```

6. **Git Commits**
   ```
   Commit 1: All implementation package.json files (custom message)
   Commit 2: Main package.json file (custom message)
   ```

### Version Strategy

The script uses this logic to determine the new version:

1. **Find highest implementation version** (e.g., `0.4.14`)
2. **Apply bump** to that version:
   - `patch`: `0.4.14` → `0.4.15`
   - `minor`: `0.4.14` → `0.5.0`
3. **Apply same version** to:
   - Main `vintasend` package
   - All implementation packages
   - All `vintasend` dependencies in implementations

This ensures **version consistency** across all packages.

## Example Session

```bash
$ npm run release

========================================
  VintaSend Release Automation
========================================

[1] Checking git status...
✓ Working directory is clean

[2] Finding highest implementation version...
ℹ Highest version: 0.4.14 (vintasend-medplum)

[3] Determining version bump type...

Select version bump type:
  1) patch (e.g., 0.4.14 → 0.4.15)
  2) minor (e.g., 0.4.14 → 0.5.0)
  3) alpha (e.g., 0.4.14 → 0.4.14-alpha1)

Enter choice (1, 2, or 3): 1

ℹ New version will be: 0.4.15 (patch bump)

[4] Getting commit message...

Commit message (press Enter for "Bump versions"): Release new features

ℹ Commit message: "Release new features"

==================================================
RELEASE SUMMARY
==================================================
New version:      0.4.15
Bump type:        patch
Commit message:   "Release new features"
==================================================

Proceed with release? (yes/no): yes

[6] Updating main package version...
✓ Updated vintasend package.json to 0.4.15

[7] Testing main package...
✓ Tests passed

[8] Building main package...
✓ Build completed

[9] Publishing main package...
⚠ Publishing main package - this will open a browser for 2FA authorization
ℹ After authorizing in the browser, you have 5 minutes to publish all packages
[npm publish output - browser opens]
✓ Published vintasend@0.4.15 to npm
⚠ Please confirm you have authorized npm publish in your browser
Press Enter after authorizing in the browser: 
✓ Authorization confirmed - proceeding with implementation publishing

[10] Updating implementation packages...
ℹ Processing vintasend-nodemailer...
✓   Updated vintasend dependency to ^0.4.15
✓   Updated package version to 0.4.15
...

[11] Building and publishing implementation packages...
ℹ Building vintasend-nodemailer...
✓   Tests passed
✓   Build completed
✓   Published vintasend-nodemailer@0.4.15
...

[12] Committing changes...
ℹ Committing implementation changes...
✓ Committed implementation changes
ℹ Committing main package changes...
✓ Committed main package changes

==================================================
✓ RELEASE COMPLETED SUCCESSFULLY!
==================================================

Released version: 0.4.15
Packages published: 8

Next steps:
  1. Update CHANGELOG.md manually
  2. Review the commits
  3. Push to remote: git push && git push --tags
```

### Alpha Release Example

```bash
$ npm run release

========================================
  VintaSend Release Automation
========================================

[1] Checking git status...
✓ Working directory is clean

[2] Finding highest implementation version...
ℹ Highest version: 0.4.14 (vintasend-medplum)

[3] Determining version bump type...

Select version bump type:
  1) patch (e.g., 0.4.14 → 0.4.15)
  2) minor (e.g., 0.4.14 → 0.5.0)
  3) alpha (e.g., 0.4.14 → 0.4.15-alpha1)

Enter choice (1, 2, or 3): 3

Select alpha base bump type:
  1) patch (e.g., 0.4.14 → 0.4.15-alpha1)
  2) minor (e.g., 0.4.14 → 0.5.0-alpha1)

Enter choice (1 or 2): 1

Enter alpha iteration number (default 1): 1

ℹ New version will be: 0.4.15-alpha1 (alpha bump)

[4] Getting commit message...

Commit message (press Enter for "Bump versions"): Release alpha version for testing new features

ℹ Commit message: "Release alpha version for testing new features"

==================================================
RELEASE SUMMARY
==================================================
New version:      0.4.15-alpha1
Bump type:        alpha
Commit message:   "Release alpha version for testing new features"
==================================================

Proceed with release? (yes/no): yes

[6] Updating main package version...
✓ Updated vintasend package.json to 0.4.15-alpha1

[7] Testing main package...
✓ Tests passed

[8] Building main package...
✓ Build completed

[9] Publishing main package...
⚠ Publishing main package - this will open a browser for 2FA authorization
ℹ After authorizing in the browser, you have 5 minutes to publish all packages
[npm publish output - browser opens]
✓ Published vintasend@0.4.15-alpha1 to npm
⚠ Please confirm you have authorized npm publish in your browser
Press Enter after authorizing in the browser: 
✓ Authorization confirmed - proceeding with implementation publishing

[10] Updating implementation packages...
ℹ Processing vintasend-nodemailer...
✓   Updated vintasend dependency to ^0.4.15-alpha1
✓   Updated package version to 0.4.15-alpha1
...

[11] Building and publishing implementation packages...
ℹ Building vintasend-nodemailer...
✓   Tests passed
✓   Build completed
✓   Published vintasend-nodemailer@0.4.15-alpha1
...

[12] Committing changes...
ℹ Committing implementation changes...
✓ Committed implementation changes
ℹ Committing main package changes...
✓ Committed main package changes

==================================================
✓ RELEASE COMPLETED SUCCESSFULLY!
==================================================

Released version: 0.4.15-alpha1
Packages published: 8

Next steps:
  1. Update CHANGELOG.md manually
  2. Review the commits
  3. Push to remote: git push && git push --tags
```

## Safety Features

### Dry Run Mode
Always test first:
```bash
npm run release:dry-run
```

Shows exactly what will happen without making any changes.

### Git Status Check
The script will **abort** if you have uncommitted changes. This prevents accidentally including unrelated changes in the release.

### Test Before Publish
Each package is tested before publishing. If tests fail:
- Main package: Script aborts
- Implementation: Skips that package and continues

### User Confirmation
Before publishing anything, you see a summary and must type "yes" to proceed.

### Two-Commit Strategy
1. **Implementations first**: If something goes wrong with the main package, implementations are already committed
2. **Main package second**: Clean separation of concerns

## Troubleshooting

### Error: "Working directory is not clean"

**Cause**: You have uncommitted changes  
**Solution**: 
```bash
git status
git add .
git commit -m "Your changes"
# Then run release script
```

### Error: "Tests failed for main package"

**Cause**: Tests in main package are failing  
**Solution**: Fix the tests before releasing
```bash
npm test
```

### Error: "Failed to publish"

**Possible causes**:
- Not logged in to npm: `npm whoami`
- No publish permissions
- Version already exists on npm
- Network issues

**Solution**:
```bash
# Login to npm
npm login

# Check your packages
npm owner ls vintasend
npm owner ls vintasend-nodemailer
```

### Warning: "Tests failed for [implementation]"

**Behavior**: Script skips that implementation and continues  
**Solution**: Fix tests for that implementation and publish manually:
```bash
cd src/implementations/[package-name]
npm test
npm run build
npm publish
```

## Post-Release Checklist

After the script completes:

- [ ] Update `CHANGELOG.md` with release notes
- [ ] Review the two commits created:
  ```bash
  git log --oneline -2
  ```
- [ ] Test locally if needed
- [ ] Push to remote:
  ```bash
  git push origin main
  ```
- [ ] Verify packages on npm:
  ```bash
  npm view vintasend
  npm view vintasend-nodemailer
  # etc.
  ```
- [ ] Announce the release (if applicable)

## Advanced Usage

### Custom Commit Messages

You can provide detailed commit messages:
```bash
npm run release
# When prompted:
# Commit message: "v0.4.15 - Add attachment support, fix email rendering bug"
```

### Selective Publishing

If you need to publish only specific packages, you can:

1. Run `npm run release:dry-run` to see what would happen
2. Manually publish specific packages:
```bash
cd src/implementations/vintasend-nodemailer
npm version 0.4.15
npm publish
```

### Rolling Back

If something goes wrong mid-release:

1. **Check what was published**:
   ```bash
   npm view vintasend versions
   npm view vintasend-nodemailer versions
   ```

2. **Unpublish if needed** (within 72 hours):
   ```bash
   npm unpublish vintasend@0.4.15
   ```

3. **Reset git commits** (if not pushed):
   ```bash
   git reset --soft HEAD~2  # Undo last 2 commits
   # Or
   git reset --hard HEAD~2  # Undo and discard changes
   ```

## Files Modified by Script

The script modifies these files:
- `/package.json` (main package version)
- `/src/implementations/*/package.json` (version + vintasend dependency)

All changes are committed automatically in two commits.

## Architecture

For detailed information about the script architecture, see [scripts/README.md](scripts/README.md).

The automation consists of:
- Main orchestrator: `scripts/release.js`
- Utilities:
  - `version-finder.js`: Version detection
  - `version-bumper.js`: Version calculation
  - `package-updater.js`: JSON manipulation
  - `publisher.js`: npm operations
  - `git-handler.js`: git operations

## Support

If you encounter issues with the release automation:

1. Try `npm run release:dry-run` first
2. Check git status: `git status`
3. Verify npm login: `npm whoami`
4. Review error messages carefully
5. Check the [Troubleshooting](#troubleshooting) section above
