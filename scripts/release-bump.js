#!/usr/bin/env node

/**
 * Release step 1: bump every workspace package to a single new version.
 *
 * "Every workspace package" means the root `vintasend` package, everything
 * under `src/implementations` and everything under `src/tools` — including the
 * repositories that are not published (the APIs and dashboards), which still
 * have to carry the release version and the new dependency ranges.
 *
 * Two things get rewritten in each package.json:
 *   1. its own `version`
 *   2. every dependency, peerDependency, devDependency and optionalDependency
 *      that points at another workspace package
 *
 * The second one used to cover only `vintasend`, which is why sibling
 * dependencies such as `vintasend-managed-templates` inside
 * `vintasend-medplum-template-manager` kept pointing at the previous release.
 */

import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compareVersions } from './utils/version-finder.js';
import { bumpVersion } from './utils/version-bumper.js';
import {
  updatePackageVersion,
  updateInternalDependencies
} from './utils/package-updater.js';
import {
  discoverWorkspacePackages,
  internalPackageNames
} from './utils/workspace-packages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const bumpType = args.find(arg => arg.startsWith('--bump='))?.split('=')[1];
const alphaBaseArg = args.find(arg => arg.startsWith('--alpha-base='))?.split('=')[1];
const dryRun = args.includes('--dry-run');
const assumeYes = args.includes('--yes') || args.includes('-y');

// Paths
const rootDir = path.join(__dirname, '..');
const stateFilePath = path.join(rootDir, '.release-state.json');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'bright');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logDetail(message) {
  log(`  ${message}`, 'gray');
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * The highest version currently in the workspace, and who carries it.
 *
 * The template is skipped: it is scaffolding, it is never released, and it is
 * routinely left on an old version — letting it win here would drag the whole
 * workspace backwards.
 */
function findHighestWorkspaceVersion(packages) {
  let highest = '0.0.0';
  let owner = '';

  for (const pkg of packages) {
    if (pkg.isTemplate) continue;
    if (!pkg.version) continue;
    if (compareVersions(pkg.version, highest) > 0) {
      highest = pkg.version;
      owner = pkg.name;
    }
  }

  return { version: highest, packageName: owner };
}

async function main() {
  try {
    log('\n========================================', 'bright');
    log('  VintaSend Release - Step 1: Bump Versions', 'bright');
    log('========================================\n', 'bright');
    if (dryRun) {
      logWarning('Dry run: no package.json will be written');
    }

    // Step 1: discover every package in the workspace
    logStep('1', 'Discovering workspace packages...');
    const packages = discoverWorkspacePackages(rootDir);
    if (packages.length === 0) {
      logError('No packages found');
      process.exit(1);
    }

    const internalNames = internalPackageNames(packages);
    const published = packages.filter(pkg => pkg.publishable);
    const companions = packages.filter(pkg => !pkg.publishable && !pkg.isTemplate);
    const template = packages.find(pkg => pkg.isTemplate);

    for (const pkg of packages) {
      const role = pkg.isTemplate ? 'template' : pkg.publishable ? 'published' : 'not published';
      logDetail(`${pkg.name}@${pkg.version} (${pkg.relPath}) — ${role}`);
    }
    logSuccess(
      `Found ${packages.length} packages: ${published.length} published, ` +
        `${companions.length} not published${template ? ', 1 template' : ''}`
    );

    // Step 2: find the version to bump from
    logStep('2', 'Finding highest version...');
    const { version: highestVersion, packageName: highestPackage } = findHighestWorkspaceVersion(packages);
    logInfo(`Starting from highest version: ${highestVersion} (${highestPackage})`);

    const behind = packages.filter(pkg => !pkg.isTemplate && pkg.version !== highestVersion);
    if (behind.length > 0) {
      logWarning(`${behind.length} package(s) are not on ${highestVersion} — they will be brought up with the bump:`);
      for (const pkg of behind) logDetail(`${pkg.name}@${pkg.version}`);
    }

    // Step 3: determine bump type
    logStep('3', 'Determining version bump type...');
    let selectedBumpType = bumpType;
    let alphaIteration = 1;
    let alphaBaseBumpType = 'patch';

    // Check if current version is an alpha version
    const isCurrentAlpha = /^(\d+\.\d+\.\d+)-alpha(\d+)$/.test(highestVersion);
    const currentAlphaMatch = highestVersion.match(/^(\d+\.\d+\.\d+)-alpha(\d+)$/);

    if (selectedBumpType === 'promote' && !isCurrentAlpha) {
      logError('Cannot promote alpha: current version is not an alpha version');
      process.exit(1);
    }

    // If --bump=alpha was passed and current version is already alpha, ask if user wants to increment
    if (selectedBumpType === 'alpha' && isCurrentAlpha) {
      console.log('\nCurrent version is already an alpha. What would you like to do?');
      console.log('  1) Increment alpha iteration only (e.g., ' + highestVersion + ' → ' + currentAlphaMatch[1] + '-alpha' + (parseInt(currentAlphaMatch[2]) + 1) + ')');
      console.log('  2) Create new alpha version (bump base version first)');
      const alphaChoice = await question('\nEnter choice (1 or 2): ');

      if (alphaChoice === '1') {
        selectedBumpType = 'alpha-iteration';
        alphaIteration = parseInt(currentAlphaMatch[2]) + 1;
      }
      // If choice is 2 or anything else, keep selectedBumpType as 'alpha' and continue
    }

    if (!selectedBumpType) {
      console.log('\nSelect version bump type:');
      console.log('  1) patch (e.g., 0.4.14 → 0.4.15)');
      console.log('  2) minor (e.g., 0.4.14 → 0.5.0)');
      console.log('  3) major (e.g., 0.4.14 → 1.0.0)');
      console.log('  4) alpha (e.g., 0.4.14 → 0.4.15-alpha1)');

      if (isCurrentAlpha) {
        console.log(`  5) increment alpha (e.g., ${highestVersion} → ${currentAlphaMatch[1]}-alpha${parseInt(currentAlphaMatch[2]) + 1})`);
        console.log(`  6) promote alpha to stable (e.g., ${highestVersion} → ${currentAlphaMatch[1]})`);
      }

      const choice = await question(`\nEnter choice (1, 2, 3, ${isCurrentAlpha ? '4, 5, or 6' : 'or 4'}): `);

      if (choice === '2') {
        selectedBumpType = 'minor';
      } else if (choice === '3') {
        selectedBumpType = 'major';
      } else if (choice === '4') {
        selectedBumpType = 'alpha';
      } else if (choice === '5' && isCurrentAlpha) {
        selectedBumpType = 'alpha-iteration';
        alphaIteration = parseInt(currentAlphaMatch[2]) + 1;
      } else if (choice === '6' && isCurrentAlpha) {
        selectedBumpType = 'promote';
      } else {
        selectedBumpType = 'patch';
      }
    }

    // If alpha was selected, ask for base bump type and iteration
    if (selectedBumpType === 'alpha') {
      if (alphaBaseArg) {
        if (!['patch', 'minor', 'major'].includes(alphaBaseArg)) {
          logError(`Invalid --alpha-base value: ${alphaBaseArg} (expected patch, minor or major)`);
          process.exit(1);
        }
        alphaBaseBumpType = alphaBaseArg;
      } else {
        console.log('\nSelect alpha base bump type:');
        console.log('  1) patch (e.g., 0.4.14 → 0.4.15-alpha1)');
        console.log('  2) minor (e.g., 0.4.14 → 0.5.0-alpha1)');
        console.log('  3) major (e.g., 0.4.14 → 1.0.0-alpha1)');
        const baseBumpChoice = await question('\nEnter choice (1, 2, or 3): ');
        alphaBaseBumpType = baseBumpChoice === '3' ? 'major' : baseBumpChoice === '2' ? 'minor' : 'patch';
      }
      logInfo(`Alpha base bump type: ${alphaBaseBumpType}`);

      const iterInput = await question('\nEnter alpha iteration number (default 1): ');
      alphaIteration = iterInput.trim() ? parseInt(iterInput, 10) : 1;
      if (isNaN(alphaIteration) || alphaIteration < 1) {
        alphaIteration = 1;
      }
      logInfo(`Alpha iteration: ${alphaIteration}`);
    }

    const newVersion = bumpVersion(highestVersion, selectedBumpType, alphaIteration, alphaBaseBumpType);
    logInfo(`New version will be: ${newVersion} (${selectedBumpType} bump)`);

    // Step 4: preview and confirm
    logStep('4', 'Previewing changes...');
    const plan = [];
    for (const pkg of packages) {
      const { updates, skipped } = updateInternalDependencies(pkg.packageJsonPath, newVersion, internalNames, true);
      plan.push({ pkg, updates, skipped, versionChanges: pkg.version !== newVersion });
    }

    for (const { pkg, updates, skipped, versionChanges } of plan) {
      if (!versionChanges && updates.length === 0 && skipped.length === 0) continue;
      log(`  ${pkg.name}`, 'blue');
      if (versionChanges) logDetail(`version ${pkg.version} → ${newVersion}`);
      for (const update of updates) {
        logDetail(`${update.field}.${update.name}: ${update.oldRange} → ${update.newRange}`);
      }
      for (const skip of skipped) {
        logWarning(`  ${pkg.name}: leaving ${skip.field}.${skip.name} at "${skip.range}" (not a plain version range)`);
      }
    }

    const totalDependencyUpdates = plan.reduce((sum, entry) => sum + entry.updates.length, 0);

    console.log('\n' + '='.repeat(50));
    log('VERSION BUMP SUMMARY', 'bright');
    console.log('='.repeat(50));
    console.log(`New version:        ${newVersion}`);
    console.log(`Bump type:          ${selectedBumpType}`);
    console.log(`Packages:           ${packages.length}`);
    console.log(`Dependency updates: ${totalDependencyUpdates}`);
    console.log('='.repeat(50) + '\n');

    if (!assumeYes && !dryRun) {
      const confirm = await question('Proceed with version bump? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        logWarning('Version bump cancelled by user');
        process.exit(0);
      }
    }

    // Step 5: write the new versions and dependency ranges
    logStep('5', 'Updating package.json files...');
    const updatedPackages = [];

    for (const pkg of packages) {
      if (dryRun) {
        updatedPackages.push({ name: pkg.name, path: pkg.packageJsonPath, dir: pkg.dir, publishable: pkg.publishable });
        continue;
      }

      updatePackageVersion(pkg.packageJsonPath, newVersion, false);
      const { updates } = updateInternalDependencies(pkg.packageJsonPath, newVersion, internalNames, false);

      const suffix = updates.length > 0 ? ` (+${updates.length} dependency range${updates.length === 1 ? '' : 's'})` : '';
      logSuccess(`${pkg.name} → ${newVersion}${suffix}`);

      updatedPackages.push({
        name: pkg.name,
        path: pkg.packageJsonPath,
        dir: pkg.dir,
        publishable: pkg.publishable
      });
    }

    // Step 6: save state for the next step
    logStep('6', 'Saving release state...');
    const releaseState = {
      version: newVersion,
      bumpType: selectedBumpType,
      timestamp: new Date().toISOString(),
      packages: updatedPackages
    };
    if (!dryRun) {
      fs.writeFileSync(stateFilePath, JSON.stringify(releaseState, null, 2));
      logSuccess('Release state saved');
    } else {
      logInfo('[dry-run] release state not written');
    }

    // Final summary
    log('\n' + '='.repeat(50), 'green');
    log(dryRun ? '✓ DRY RUN COMPLETED' : '✓ VERSION BUMP COMPLETED!', 'green');
    log('='.repeat(50), 'green');
    console.log(`\nAll packages bumped to version: ${newVersion}`);
    console.log(`Packages updated: ${updatedPackages.length}`);
    console.log('\nNext steps:');
    console.log('  1. Review the version changes: git diff && git submodule foreach git diff');
    console.log('  2. Update CHANGELOG.md with release notes');
    console.log('  3. Run: npm run release:tag -- --commit');
    console.log('     (it commits, pushes, tags and waits for npm one dependency wave at a time)');
    console.log('');

  } catch (error) {
    logError(`\nError: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main();
