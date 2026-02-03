const fs = require('fs');
const path = require('path');

/**
 * Find the highest version among implementation packages
 * @param {string} implementationsDir - Path to implementations directory
 * @returns {{version: string, packageName: string}}
 */
function findHighestVersion(implementationsDir) {
  const implementations = fs.readdirSync(implementationsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => dirent.name !== 'vintasend-implementation-template')
    .map(dirent => dirent.name);

  let highestVersion = '0.0.0';
  let packageWithHighestVersion = '';

  for (const impl of implementations) {
    const packageJsonPath = path.join(implementationsDir, impl, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    if (compareVersions(version, highestVersion) > 0) {
      highestVersion = version;
      packageWithHighestVersion = packageJson.name;
    }
  }

  return {
    version: highestVersion,
    packageName: packageWithHighestVersion
  };
}

/**
 * Compare two semver versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} - 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}

/**
 * Get all implementation package paths
 * @param {string} implementationsDir - Path to implementations directory
 * @returns {string[]} - Array of package.json paths
 */
function getImplementationPackages(implementationsDir) {
  const implementations = fs.readdirSync(implementationsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => dirent.name !== 'vintasend-implementation-template')
    .map(dirent => dirent.name);

  return implementations
    .map(impl => path.join(implementationsDir, impl, 'package.json'))
    .filter(pkgPath => fs.existsSync(pkgPath));
}

module.exports = {
  findHighestVersion,
  compareVersions,
  getImplementationPackages
};
