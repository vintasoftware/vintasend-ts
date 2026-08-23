import fs from 'node:fs';
import path from 'node:path';

import { DEPENDENCY_FIELDS } from './workspace-packages.js';

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

  // Update in devDependencies. Packages that expose vintasend via
  // peerDependencies typically also list it in devDependencies so the types
  // resolve during local build/test. If we bump the peer but leave the dev
  // at an older range, `npm install` pulls a stale published vintasend and
  // overwrites any workspace symlink — breaking builds when newer types are
  // expected.
  if (packageJson.devDependencies && packageJson.devDependencies.vintasend) {
    const oldVersion = packageJson.devDependencies.vintasend;
    packageJson.devDependencies.vintasend = `^${newVersion}`;
    updates.push({ field: 'devDependencies', oldVersion, newVersion: `^${newVersion}` });
  }

  if (updates.length > 0 && !dryRun) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  return { path: packageJsonPath, updates };
}

/**
 * Rewrite a dependency range onto a new version, keeping the operator.
 *
 * The workspace deliberately mixes styles — `^1.0.0-alpha2` where a range is
 * fine, a pinned `1.0.0-alpha2` where a package must move in lockstep with its
 * core — so the operator that is already there is the intent to preserve.
 *
 * Anything that is not a plain single-version range (a git URL, `file:`,
 * `workspace:*`, `*`, a compound `>=1 <2`) returns null: those are deliberate
 * and the caller reports them instead of mangling them.
 *
 * @param {string} range - Existing range, e.g. "^1.0.0-alpha2"
 * @param {string} newVersion - Version to point at
 * @returns {string|null} - New range, or null when the range is not rewritable
 */
function rewriteDependencyRange(range, newVersion) {
  const match = /^(\^|~|>=|<=|>|<|=)?\s*\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.exec(String(range).trim());
  if (!match) return null;
  return `${match[1] || ''}${newVersion}`;
}

/**
 * Point every dependency on another workspace package at the new version.
 *
 * This replaces the old vintasend-only rewrite, which left sibling dependencies
 * (`vintasend-managed-templates` inside `vintasend-medplum-template-manager`,
 * `vintasend-dashboard-core` inside `vintasend-dashboard`, …) pinned to the
 * previous release — so their publish workflows installed a stale core.
 *
 * @param {string} packageJsonPath - Path to package.json
 * @param {string} newVersion - New version for every internal dependency
 * @param {Set<string>|Iterable<string>} internalNames - Names owned by this workspace
 * @param {boolean} dryRun - If true, don't actually write the file
 * @returns {{path: string, updates: Array, skipped: Array}}
 */
function updateInternalDependencies(packageJsonPath, newVersion, internalNames, dryRun = false) {
  const names = internalNames instanceof Set ? internalNames : new Set(internalNames);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const selfName = packageJson.name;
  const updates = [];
  const skipped = [];

  for (const field of DEPENDENCY_FIELDS) {
    const declared = packageJson[field];
    if (!declared) continue;

    for (const [depName, oldRange] of Object.entries(declared)) {
      if (depName === selfName) continue;
      if (!names.has(depName)) continue;

      const newRange = rewriteDependencyRange(oldRange, newVersion);
      if (newRange === null) {
        skipped.push({ field, name: depName, range: oldRange });
        continue;
      }
      if (newRange === oldRange) continue;

      declared[depName] = newRange;
      updates.push({ field, name: depName, oldRange, newRange });
    }
  }

  if (updates.length > 0 && !dryRun) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  return { path: packageJsonPath, updates, skipped };
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

export {
  updatePackageVersion,
  updateVintasendDependency,
  updateInternalDependencies,
  rewriteDependencyRange,
  readPackageJson,
  getPackageName
};
