# VintaSend Release - Quick Reference

## Two-Step Process

### Step 1: Bump Versions
```bash
npm run release:bump          # Interactive
npm run release:bump:patch    # Direct patch
npm run release:bump:minor    # Direct minor
```

### Step 2: Update CHANGELOG.md
Edit the file manually with release notes.

### Step 3: Publish
```bash
npm run release:publish
```

## What Happens

**Step 1:**
1. ✓ Finds highest version among implementations
2. ✓ Bumps version (you choose patch or minor)
3. ✓ Updates all package.json files
4. ✓ Saves state for step 2

**Step 2:**
1. ✓ Tests and builds main package
2. ✓ Commits main package (custom message, includes CHANGELOG.md)
3. ✓ Publishes main package (2FA in browser)
4. ✓ For each implementation:
   - Prompts for custom commit message
   - Tests and builds
   - Commits (individual commit per package)
   - Publishes (within 5-min 2FA window)

## What You Do After

**After Step 1:**
1. Review changes: `git diff`
2. Update `CHANGELOG.md`

**After Step 2:**
1. Review commits: `git log`
2. Push: `git push`

## Current Versions

- **Highest**: `vintasend-medplum@0.4.14`
- **Next**: Will be `0.4.15` (patch) or `0.5.0` (minor)

## Safety

- Git must be clean before starting
- Dry-run mode available for testing
- Confirmation prompt before publishing
- Tests run before each publish

## Troubleshooting

| Error | Solution |
|-------|----------|
| Working directory not clean | Commit changes first |
| Tests failed | Fix tests before releasing |
| Not logged in to npm | Run `npm login` |
| Failed to publish | Check npm permissions |

## Files Created

- `scripts/release.js` - Main automation
- `scripts/utils/*.js` - Helper utilities
- `RELEASE_GUIDE.md` - Full documentation
- `scripts/README.md` - (between step 1 and 2)
- ✋ Provide commit message for each package
- ✋ Review commits and changes
- ✋ Push to remote

---

**First time?** Run `npm run release:bump:patch` to see step 1 in action

---

**First time?** Run `npm run release:dry-run` to see what happens!
