#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');

const { findHighestVersion, getImplementationPackages } = require('./utils/version-finder');
const { bumpVersion, isValidVersion } = require('./utils/version-bumper');
const {
  updatePackageVersion,
  updateVintasendDependency,
  getPackageName,
  readPackageJson
} = require('./utils/package-updater');
const { compareVersions } = require('./utils/version-finder');

// Parse command line arguments
const args = process.argv.slice(2);
const bumpType = args.find(arg => arg.startsWith('--bump='))?.split('=')[1];

// Paths
const rootDir = path.join(__dirname, '..');
const implementationsDir = path.join(rootDir, 'src', 'implementations');
const rootPackageJsonPath = path.join(rootDir, 'package.json');
const stateFilePath = path.join(rootDir, '.release-state.json');

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
    log('  VintaSend Release - Step 1: Bump Versions', 'bright');
    log('========================================\n', 'bright');

    // Step 1: Find highest version (including main package)
    logStep('1', 'Finding highest version...');
    
    // Get main package version
    const mainPackage = readPackageJson(rootPackageJsonPath);
    const mainVersion = mainPackage.version;
    logInfo(`Main package (vintasend) version: ${mainVersion}`);
    
    // Get highest implementation version
    const { version: highestImplVersion, packageName: highestImplPackage } = findHighestVersion(implementationsDir);
    logInfo(`Highest implementation version: ${highestImplVersion} (${highestImplPackage})`);
    
    // Compare and find the true highest
    let highestVersion = mainVersion;
    let highestPackage = 'vintasend';
    
    if (compareVersions(highestImplVersion, mainVersion) > 0) {
      highestVersion = highestImplVersion;
      highestPackage = highestImplPackage;
    }
    
    log('');
    logInfo(`Starting from highest version: ${highestVersion} (${highestPackage})`);

    // Step 2: Determine bump type
    logStep('2', 'Determining version bump type...');
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

    // Step 3: Confirm before proceeding
    console.log('\n' + '='.repeat(50));
    log('VERSION BUMP SUMMARY', 'bright');
    console.log('='.repeat(50));
    console.log(`New version:      ${newVersion}`);
    console.log(`Bump type:        ${selectedBumpType}`);
    console.log('='.repeat(50) + '\n');

    const confirm = await question('Proceed with version bump? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      logWarning('Version bump cancelled by user');
      process.exit(0);
    }

    // Step 4: Update main package version
    logStep('4', 'Updating main package version...');
    updatePackageVersion(rootPackageJsonPath, newVersion, false);
    logSuccess(`Updated vintasend package.json to ${newVersion}`);

    // Step 5: Update implementation dependencies and versions
    logStep('5', 'Updating implementation packages...');
    const implementationPackages = getImplementationPackages(implementationsDir);
    const updatedPackages = [];

    for (const pkgPath of implementationPackages) {
      const packageName = getPackageName(pkgPath);
      logInfo(`Processing ${packageName}...`);

      // Update vintasend dependency
      const depUpdate = updateVintasendDependency(pkgPath, newVersion, false);
      if (depUpdate.updates.length > 0) {
        logSuccess(`  Updated vintasend dependency to ^${newVersion}`);
      }

      // Update package version
      updatePackageVersion(pkgPath, newVersion, false);
      logSuccess(`  Updated package version to ${newVersion}`);

      updatedPackages.push({
        name: packageName,
        path: pkgPath,
        dir: path.dirname(pkgPath)
      });
    }

    // Step 6: Save state for next step
    logStep('6', 'Saving release state...');
    const releaseState = {
      version: newVersion,
      bumpType: selectedBumpType,
      timestamp: new Date().toISOString(),
      packages: updatedPackages
    };
    fs.writeFileSync(stateFilePath, JSON.stringify(releaseState, null, 2));
    logSuccess('Release state saved');

    // Final summary
    log('\n' + '='.repeat(50), 'green');
    log('✓ VERSION BUMP COMPLETED!', 'green');
    log('='.repeat(50), 'green');
    console.log(`\nAll packages bumped to version: ${newVersion}`);
    console.log(`Packages updated: ${updatedPackages.length + 1}`);
    console.log('\nNext steps:');
    console.log('  1. Review the version changes: git diff');
    console.log('  2. Update CHANGELOG.md with release notes');
    console.log('  3. Run: npm run release:publish');
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
