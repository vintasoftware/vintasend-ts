#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');

const { readPackageJson, getPackageName } = require('./utils/package-updater');
const { buildPackage, testPackage, publishPackage } = require('./utils/publisher');
const { stageFiles, commit } = require('./utils/git-handler');

// Paths
const rootDir = path.join(__dirname, '..');
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
    log('  VintaSend Release - Step 2: Publish', 'bright');
    log('========================================\n', 'bright');

    // Step 1: Load release state
    logStep('1', 'Loading release state...');
    if (!fs.existsSync(stateFilePath)) {
      logError('Release state not found. Please run: npm run release:bump first');
      process.exit(1);
    }

    const releaseState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    const { version, packages } = releaseState;
    logInfo(`Release version: ${version}`);
    logInfo(`Packages to publish: ${packages.length + 1}`);

    // Step 2: Get commit message for main package
    logStep('2', 'Getting commit message for main package...');
    const defaultMainCommit = `Release v${version}`;
    const mainCommitMessage = await question(`Commit message for main package (press Enter for "${defaultMainCommit}"): `);
    const finalMainCommit = mainCommitMessage.trim() || defaultMainCommit;
    logInfo(`Main package commit: "${finalMainCommit}"`);

    // Step 3: Test and build main package
    logStep('3', 'Testing main package...');
    const testResult = testPackage(rootDir, false);
    if (testResult.success === false) {
      logError('Tests failed for main package!');
      console.log(testResult.error);
      process.exit(1);
    }
    logSuccess('Tests passed');

    logStep('4', 'Building main package...');
    buildPackage(rootDir, false);
    logSuccess('Build completed');

    // Step 5: Commit main package
    logStep('5', 'Committing main package...');
    stageFiles(['.'], false); // Stage all changes
    commit(finalMainCommit, false);
    logSuccess('Main package committed');

    // Step 6: Publish main package
    logStep('6', 'Publishing main package...');
    logWarning('Publishing main package - this will open a browser for 2FA authorization');
    logInfo('After authorizing in the browser, you have 5 minutes to publish all packages');
    publishPackage(rootDir, false);
    logSuccess(`Published vintasend@${version} to npm`);

    logWarning('Please confirm you have authorized npm publish in your browser');
    await question('Press Enter after authorizing in the browser: ');
    logSuccess('Authorization confirmed - proceeding with implementation publishing');

    // Step 7: For each implementation, get commit message, test, build, commit, and publish
    logStep('7', `Publishing ${packages.length} implementation packages...`);

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const pkgNum = i + 1;

      log(`\n${'─'.repeat(60)}`, 'cyan');
      log(`Package ${pkgNum}/${packages.length}: ${pkg.name}`, 'bright');
      log('─'.repeat(60), 'cyan');

      // Get commit message for this implementation
      const defaultCommit = `Release ${pkg.name}@${version}`;
      const commitMsg = await question(`\nCommit message for ${pkg.name} (press Enter for "${defaultCommit}"): `);
      const finalCommit = commitMsg.trim() || defaultCommit;

      // Install dependencies (to get the newly published vintasend)
      logInfo('Installing dependencies...');
      const { execSync } = require('child_process');
      try {
        execSync('npm install', { cwd: pkg.dir, stdio: 'inherit' });
        logSuccess('Dependencies installed');
      } catch (error) {
        logError(`Failed to install dependencies for ${pkg.name}: ${error.message}`);
        continue;
      }

      // Test
      logInfo('Running tests...');
      const pkgTestResult = testPackage(pkg.dir, false);
      if (pkgTestResult.success === false) {
        logWarning(`Tests failed for ${pkg.name}, skipping...`);
        console.log(pkgTestResult.error);
        continue;
      }
      logSuccess('Tests passed');

      // Build
      logInfo('Building...');
      buildPackage(pkg.dir, false);
      logSuccess('Build completed');

      // Commit
      logInfo('Committing...');
      stageFiles(['.'], false, pkg.dir); // Stage all changes in implementation directory
      commit(finalCommit, false, pkg.dir); // Commit in implementation directory
      logSuccess('Committed');

      // Publish
      logInfo('Publishing to npm...');
      try {
        publishPackage(pkg.dir, false);
        logSuccess(`Published ${pkg.name}@${version}`);
      } catch (error) {
        logError(`Failed to publish ${pkg.name}: ${error.message}`);
      }
    }

    // Step 8: Clean up state file
    logStep('8', 'Cleaning up...');
    fs.unlinkSync(stateFilePath);
    logSuccess('Release state cleaned');

    // Final summary
    log('\n' + '='.repeat(50), 'green');
    log('✓ RELEASE COMPLETED SUCCESSFULLY!', 'green');
    log('='.repeat(50), 'green');
    console.log(`\nReleased version: ${version}`);
    console.log(`Packages published: ${packages.length + 1}`);
    console.log('\nNext steps:');
    console.log('  1. Review the commits: git log');
    console.log('  2. Push to remote: git push');
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
