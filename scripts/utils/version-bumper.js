/**
 * Bump a version number
 * @param {string} version - Current version (e.g., "0.4.14" or "0.4.14-alpha1")
 * @param {'patch' | 'minor' | 'major' | 'alpha' | 'alpha-iteration' | 'promote'} bumpType - Type of version bump
 * @param {number} alphaIteration - Alpha iteration number (used when bumpType is 'alpha' or 'alpha-iteration')
 * @param {'patch' | 'minor'} alphaBaseBumpType - Base bump type for alpha (patch or minor, defaults to patch)
 * @returns {string} - New version
 */
function bumpVersion(version, bumpType, alphaIteration = 1, alphaBaseBumpType = 'patch') {
  if (bumpType === 'promote') {
    const alphaMatch = version.match(/^(\d+\.\d+\.\d+)(-alpha\d+)?$/);
    if (!alphaMatch) {
      throw new Error('Cannot promote alpha: invalid version format');
    }
    if (!alphaMatch[2]) {
      throw new Error('Cannot promote alpha: current version is not an alpha version');
    }
    return alphaMatch[1];
  }

  // Handle alpha iteration bump (just increment the alpha number without changing base version)
  if (bumpType === 'alpha-iteration') {
    const alphaMatch = version.match(/^(\d+\.\d+\.\d+)-alpha(\d+)$/);
    if (!alphaMatch) {
      throw new Error('Cannot bump alpha iteration: current version is not an alpha version');
    }
    const baseVersion = alphaMatch[1];
    return `${baseVersion}-alpha${alphaIteration}`;
  }

  // Handle alpha versions
  if (bumpType === 'alpha') {
    // If current version is an alpha, extract the base version
    const alphaMatch = version.match(/^(\d+\.\d+\.\d+)(-alpha\d+)?$/);
    const baseVersion = alphaMatch ? alphaMatch[1] : version;

    // Bump the base version first (patch or minor)
    const bumpedBase = bumpVersionCore(baseVersion, alphaBaseBumpType);
    return `${bumpedBase}-alpha${alphaIteration}`;
  }

  // For regular version bumps, strip any alpha suffix first
  const alphaMatch = version.match(/^(\d+\.\d+\.\d+)/);
  const baseVersion = alphaMatch ? alphaMatch[1] : version;

  return bumpVersionCore(baseVersion, bumpType);
}

/**
 * Core version bumping logic
 * @param {string} version - Semantic version without alpha (e.g., "0.4.14")
 * @param {'patch' | 'minor' | 'major'} bumpType - Type of version bump
 * @returns {string} - New version
 */
function bumpVersionCore(version, bumpType) {
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
 * Validate semver version format (including alpha versions)
 * @param {string} version - Version to validate
 * @returns {boolean}
 */
function isValidVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+(-alpha\d+)?$/;
  return semverRegex.test(version);
}

module.exports = {
  bumpVersion,
  isValidVersion
};
