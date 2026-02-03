/**
 * Bump a version number
 * @param {string} version - Current version (e.g., "0.4.14")
 * @param {'patch' | 'minor' | 'major'} bumpType - Type of version bump
 * @returns {string} - New version
 */
function bumpVersion(version, bumpType) {
  const parts = version.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }

  return parts.join('.');
}

/**
 * Validate semver version format
 * @param {string} version - Version to validate
 * @returns {boolean}
 */
function isValidVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  return semverRegex.test(version);
}

module.exports = {
  bumpVersion,
  isValidVersion
};
