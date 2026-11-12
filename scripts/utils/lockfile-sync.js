import fs from 'node:fs';
import path from 'node:path';

/**
 * Lockfile checks for the release.
 *
 * Every publish workflow runs `npm ci`, which refuses a `package-lock.json` that
 * does not satisfy `package.json`. The bump rewrites every internal range to
 * the release version, so a repository that commits a lockfile has to have that
 * lockfile regenerated as well — and it can only be regenerated once the
 * packages it depends on are on npm at that version, which is exactly when the
 * repository's wave comes up.
 *
 * These helpers only read; `release-tag.js` runs npm.
 */

const LOCKFILE = 'package-lock.json';

/** The installed package name a lockfile `packages` key stands for, or null for the root entry. */
function packageNameFromLockKey(key) {
  if (key === '') return null;
  const marker = 'node_modules/';
  const index = key.lastIndexOf(marker);
  return index === -1 ? null : key.slice(index + marker.length);
}

/**
 * Where a lockfile disagrees with the release.
 *
 * @param {object} lockfile - parsed package-lock.json (lockfileVersion 2 or 3)
 * @param {object} release
 * @param {string} release.version - the version being released
 * @param {Set<string>} release.internalNames - every workspace package name
 * @param {string} release.registry - registry URL the published tarballs come from
 * @returns {string[]} one line per problem; empty when the lockfile is in sync
 */
function lockfileDrift(lockfile, { version, internalNames, registry }) {
  const packages = lockfile && lockfile.packages;
  if (!packages || typeof packages !== 'object') {
    return [`${LOCKFILE} has no "packages" map (lockfileVersion 2 or later is required)`];
  }

  const problems = [];
  const root = packages[''];
  if (root && root.version !== undefined && root.version !== version) {
    problems.push(`its own version is ${root.version}, not ${version}`);
  }

  const registryPrefix = registry.endsWith('/') ? registry : `${registry}/`;
  for (const [key, entry] of Object.entries(packages)) {
    const name = packageNameFromLockKey(key);
    if (!name || !internalNames.has(name)) continue;

    if (entry.link) {
      problems.push(`${key} is a link to ${entry.resolved}, not the published package`);
    } else if (entry.version !== version) {
      problems.push(`${key} is locked at ${entry.version}, not ${version}`);
    } else if (entry.resolved && !entry.resolved.startsWith(registryPrefix)) {
      problems.push(`${key} resolves from ${entry.resolved}, not the registry`);
    }
  }

  return problems;
}

/**
 * Read a package's lockfile and report its drift, or null when it has none on
 * disk.
 */
function readLockfileDrift(dir, release) {
  const file = path.join(dir, LOCKFILE);
  if (!fs.existsSync(file)) return null;

  let lockfile;
  try {
    lockfile = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return [`${LOCKFILE} is not valid JSON: ${error.message}`];
  }
  return lockfileDrift(lockfile, release);
}

/**
 * Whether npm failed because a version it was asked for is not served yet —
 * the registry lag right after a wave goes live, worth waiting out.
 */
function isNotYetPublishedError(output) {
  return /ETARGET|E404|No matching version found|notarget|is not in this registry/i.test(output);
}

export { LOCKFILE, lockfileDrift, readLockfileDrift, isNotYetPublishedError };
