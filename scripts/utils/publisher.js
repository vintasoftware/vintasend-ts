const { execSync } = require('child_process');
const path = require('path');

/**
 * Run a command and return output
 * @param {string} command - Command to run
 * @param {string} cwd - Working directory
 * @returns {string} - Command output
 */
function runCommand(command, cwd = process.cwd()) {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe']
    });
    return output.trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Build a package
 * @param {string} packageDir - Directory containing the package
 * @param {boolean} dryRun - If true, don't actually run the command
 */
function buildPackage(packageDir, dryRun = false) {
  const command = 'npm run build';

  if (dryRun) {
    return { command, cwd: packageDir, dryRun: true };
  }

  const output = runCommand(command, packageDir);
  return { command, cwd: packageDir, output };
}

/**
 * Run tests for a package
 * @param {string} packageDir - Directory containing the package
 * @param {boolean} dryRun - If true, don't actually run the command
 */
function testPackage(packageDir, dryRun = false) {
  const command = 'npm test';

  if (dryRun) {
    return { command, cwd: packageDir, dryRun: true };
  }

  try {
    const output = runCommand(command, packageDir);
    return { command, cwd: packageDir, output, success: true };
  } catch (error) {
    return { command, cwd: packageDir, error: error.message, success: false };
  }
}

/**
 * Publish a package to npm
 * @param {string} packageDir - Directory containing the package
 * @param {boolean} dryRun - If true, don't actually publish
 */
function publishPackage(packageDir, dryRun = false) {
  // Read package.json to check if it's a pre-release version
  const fs = require('fs');
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  
  // Check if it's a pre-release version (contains a hyphen, e.g., 1.0.0-alpha1)
  const isPreRelease = version.includes('-');
  
  // Add --tag flag for pre-release versions
  const command = isPreRelease ? 'npm publish --tag alpha' : 'npm publish';

  if (dryRun) {
    return { command, cwd: packageDir, dryRun: true };
  }

  // Use inherit for stdio to allow browser 2FA to work
  try {
    execSync(command, {
      cwd: packageDir,
      encoding: 'utf8',
      stdio: 'inherit'
    });
    return { command, cwd: packageDir, success: true };
  } catch (error) {
    throw new Error(`Failed to publish from ${packageDir}: ${error.message}`);
  }
}

module.exports = {
  runCommand,
  buildPackage,
  testPackage,
  publishPackage
};
