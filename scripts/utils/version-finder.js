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
 * Compare two semver versions (including alpha versions)
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} - 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  // Extract base version and alpha info from both versions
  const parseVersion = (version) => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-alpha(\d+))?$/);
    if (!match) return { major: 0, minor: 0, patch: 0, alphaNum: null };
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      alphaNum: match[4] ? parseInt(match[4]) : null
    };
  };

  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  // Compare major
  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  // Compare minor
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  // Compare patch
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  // Both have same base version, compare alpha versions
  // If both have no alpha, they're equal
  if (p1.alphaNum === null && p2.alphaNum === null) return 0;
  // If one has alpha and one doesn't, the stable version is higher
  if (p1.alphaNum === null) return 1; // v1 is stable, v2 is alpha
  if (p2.alphaNum === null) return -1; // v2 is stable, v1 is alpha
  // Both are alpha versions, compare iteration numbers
  return p1.alphaNum > p2.alphaNum ? 1 : p1.alphaNum < p2.alphaNum ? -1 : 0;
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
