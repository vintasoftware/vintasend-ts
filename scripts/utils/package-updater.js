const fs = require('fs');
const path = require('path');

/**
 * Update version in a package.json file
 * @param {string} packageJsonPath - Path to package.json
 * @param {string} newVersion - New version to set
 * @param {boolean} dryRun - If true, don't actually write the file
 */
function updatePackageVersion(packageJsonPath, newVersion, dryRun = false) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;

  packageJson.version = newVersion;

  if (!dryRun) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  return { oldVersion, newVersion, path: packageJsonPath };
}

/**
 * Update vintasend dependency version in a package.json file
 * @param {string} packageJsonPath - Path to package.json
 * @param {string} newVersion - New version to set for vintasend dependency
 * @param {boolean} dryRun - If true, don't actually write the file
 */
function updateVintasendDependency(packageJsonPath, newVersion, dryRun = false) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const updates = [];

  // Update in dependencies
  if (packageJson.dependencies && packageJson.dependencies.vintasend) {
    const oldVersion = packageJson.dependencies.vintasend;
    packageJson.dependencies.vintasend = `^${newVersion}`;
    updates.push({ field: 'dependencies', oldVersion, newVersion: `^${newVersion}` });
  }

  // Update in peerDependencies
  if (packageJson.peerDependencies && packageJson.peerDependencies.vintasend) {
    const oldVersion = packageJson.peerDependencies.vintasend;
    packageJson.peerDependencies.vintasend = `^${newVersion}`;
    updates.push({ field: 'peerDependencies', oldVersion, newVersion: `^${newVersion}` });
  }

  if (updates.length > 0 && !dryRun) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  return { path: packageJsonPath, updates };
}

/**
 * Read package.json
 * @param {string} packageJsonPath - Path to package.json
 * @returns {Object} - Parsed package.json
 */
function readPackageJson(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

/**
 * Get package name from package.json
 * @param {string} packageJsonPath - Path to package.json
 * @returns {string} - Package name
 */
function getPackageName(packageJsonPath) {
  const packageJson = readPackageJson(packageJsonPath);
  return packageJson.name;
}

module.exports = {
  updatePackageVersion,
  updateVintasendDependency,
  readPackageJson,
  getPackageName
};
