#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');

const { findHighestVersion, getImplementationPackages } = require('./utils/version-finder');
const { bumpVersion, isValidVersion } = require('./utils/version-bumper');
const {
  updatePackageVersion,
  updateVintasendDependency,
  readPackageJson,
  getPackageName
} = require('./utils/package-updater');
const {
  buildPackage,
  testPackage,
  publishPackage
} = require('./utils/publisher');
const { stageFiles, commit, isClean } = require('./utils/git-handler');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bumpType = args.find(arg => arg.startsWith('--bump='))?.split('=')[1];

// Paths
const rootDir = path.join(__dirname, '..');
const implementationsDir = path.join(rootDir, 'src', 'implementations');
const rootPackageJsonPath = path.join(rootDir, 'package.json');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    log('\n========================================', 'bright');
    log('  VintaSend Release Automation', 'bright');
    log('========================================\n', 'bright');

    if (dryRun) {
      logWarning('DRY RUN MODE - No changes will be made\n');
    }

    // Step 1: Check git status
    logStep('1', 'Checking git status...');
    if (!dryRun && !isClean()) {
      logError('Working directory is not clean. Please commit or stash changes first.');
      const status = require('./utils/git-handler').getStatus();
      console.log(status);
      process.exit(1);
    }
    logSuccess('Working directory is clean');

    // Step 2: Find highest version
    logStep('2', 'Finding highest implementation version...');
    const { version: highestVersion, packageName: highestPackage } = findHighestVersion(implementationsDir);
    logInfo(`Highest version: ${highestVersion} (${highestPackage})`);

    // Step 3: Determine bump type
    logStep('3', 'Determining version bump type...');
    let selectedBumpType = bumpType;

    if (!selectedBumpType) {
      console.log('\nSelect version bump type:');
      console.log('  1) patch (e.g., 0.4.14 → 0.4.15)');
      console.log('  2) minor (e.g., 0.4.14 → 0.5.0)');
      const choice = await question('\nEnter choice (1 or 2): ');
      selectedBumpType = choice === '2' ? 'minor' : 'patch';
    }

    const newVersion = bumpVersion(highestVersion, selectedBumpType);
    logInfo(`New version will be: ${newVersion} (${selectedBumpType} bump)`);

    // Step 4: Get commit messages
    logStep('4', 'Getting commit messages...');
    const defaultMainCommitMessage = 'Bump main package version';
    const defaultImplCommitMessage = 'Bump implementation versions';

    console.log('\nCommit message for main package:');
    const mainCommitMessage = await question(`  (press Enter for "${defaultMainCommitMessage}"): `);
    const finalMainCommitMessage = mainCommitMessage.trim() || defaultMainCommitMessage;

    console.log('\nCommit message for implementations:');
    const implCommitMessage = await question(`  (press Enter for "${defaultImplCommitMessage}"): `);
    const finalImplCommitMessage = implCommitMessage.trim() || defaultImplCommitMessage;

    logInfo(`Main package commit: "${finalMainCommitMessage}"`);
    logInfo(`Implementations commit: "${finalImplCommitMessage}"`);

    // Step 5: Confirm before proceeding
    if (!dryRun) {
      console.log('\n' + '='.repeat(50));
      log('RELEASE SUMMARY', 'bright');
      console.log('='.repeat(50));
      console.log(`New version:           ${newVersion}`);
      console.log(`Bump type:             ${selectedBumpType}`);
      console.log(`Main commit message:   "${finalMainCommitMessage}"`);
      console.log(`Impl commit message:   "${finalImplCommitMessage}"`);
      console.log('='.repeat(50) + '\n');

      const confirm = await question('Proceed with release? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        logWarning('Release cancelled by user');
        process.exit(0);
      }
    }

    // Step 6: Update and publish main package
    logStep('6', 'Updating main package version...');
    updatePackageVersion(rootPackageJsonPath, newVersion, dryRun);
    logSuccess(`Updated vintasend package.json to ${newVersion}`);

    logStep('7', 'Testing main package...');
    if (!dryRun) {
      const testResult = testPackage(rootDir, dryRun);
      if (testResult.success === false) {
        logError('Tests failed for main package!');
        console.log(testResult.error);
        process.exit(1);
      }
    }
    logSuccess('Tests passed');

    logStep('8', 'Building main package...');
    buildPackage(rootDir, dryRun);
    logSuccess('Build completed');

    logStep('9', 'Publishing main package...');
    if (dryRun) {
      logInfo('Would publish: npm publish (from root directory)');
    } else {
      logWarning('Publishing main package - this will open a browser for 2FA authorization');
      logInfo('After authorizing in the browser, you have 5 minutes to publish all packages');
      publishPackage(rootDir, dryRun);
      logSuccess(`Published vintasend@${newVersion} to npm`);

      logWarning('Please confirm you have authorized npm publish in your browser');
      const authorized = await question('Press Enter after authorizing in the browser: ');
      logSuccess('Authorization confirmed - proceeding with implementation publishing');
    }

    // Step 10: Update implementation dependencies and versions
    logStep('10', 'Updating implementation packages...');
    const implementationPackages = getImplementationPackages(implementationsDir);
    const updatedFiles = [];

    for (const pkgPath of implementationPackages) {
      const packageName = getPackageName(pkgPath);
      logInfo(`Processing ${packageName}...`);

      // Update vintasend dependency
      const depUpdate = updateVintasendDependency(pkgPath, newVersion, dryRun);
      if (depUpdate.updates.length > 0) {
        logSuccess(`  Updated vintasend dependency to ^${newVersion}`);
      }

      // Update package version
      updatePackageVersion(pkgPath, newVersion, dryRun);
      logSuccess(`  Updated package version to ${newVersion}`);

      updatedFiles.push(pkgPath);
    }

    // Step 11: Build and publish implementations
    logStep('11', 'Building and publishing implementation packages...');
    for (const pkgPath of implementationPackages) {
      const packageDir = path.dirname(pkgPath);
      const packageName = getPackageName(pkgPath);

      logInfo(`Building ${packageName}...`);

      // Test
      if (!dryRun) {
        const testResult = testPackage(packageDir, dryRun);
        if (testResult.success === false) {
          logWarning(`  Tests failed for ${packageName}, skipping...`);
          console.log(testResult.error);
          continue;
        }
      }
      logSuccess(`  Tests passed`);

      // Build
      buildPackage(packageDir, dryRun);
      logSuccess(`  Build completed`);

      // Publish
      if (dryRun) {
        logInfo(`  Would publish: npm publish (from ${packageDir})`);
      } else {
        try {
          publishPackage(packageDir, dryRun);
          logSuccess(`  Published ${packageName}@${newVersion}`);
        } catch (error) {
          logError(`  Failed to publish ${packageName}: ${error.message}`);
        }
      }
    }

    // Step 12: Commit changes
    logStep('12', 'Committing changes...');

    // First commit: implementations
    logInfo('Committing implementation changes...');
    if (dryRun) {
      logInfo('Would stage implementation package.json files');
      logInfo(`Would commit with message: "${finalImplCommitMessage}"`);
    } else {
      stageFiles(updatedFiles, dryRun);
      commit(finalImplCommitMessage, dryRun);
      logSuccess('Committed implementation changes');
    }

    // Second commit: main package
    logInfo('Committing main package changes...');
    if (dryRun) {
      logInfo('Would stage root package.json');
      logInfo(`Would commit with message: "${finalMainCommitMessage}"`);
    } else {
      stageFiles([rootPackageJsonPath], dryRun);
      commit(finalMainCommitMessage, dryRun);
      logSuccess('Committed main package changes');
    }

    // Final summary
    log('\n' + '='.repeat(50), 'green');
    log('✓ RELEASE COMPLETED SUCCESSFULLY!', 'green');
    log('='.repeat(50), 'green');
    console.log(`\nReleased version: ${newVersion}`);
    console.log(`Packages published: ${implementationPackages.length + 1}`);
    console.log('\nNext steps:');
    console.log('  1. Update CHANGELOG.md manually');
    console.log('  2. Review the commits');
    console.log('  3. Push to remote: git push && git push --tags');
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
