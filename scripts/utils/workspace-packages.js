import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared package discovery for the release scripts.
 *
 * Every release script needs the same answer to "which packages are part of
 * this workspace?" — the root `vintasend` package, every implementation under
 * `src/implementations` and every tool under `src/tools`. Keeping the walk in
 * one place is what stops the bump step from bumping a different set than the
 * tag step releases (which is how `src/tools/*` ended up missing version bumps).
 */

const TEMPLATE_DIR_NAME = 'vintasend-implementation-template';

/**
 * Dependency fields that can point at another workspace package.
 *
 * devDependencies count: each repository's publish workflow runs `npm install`
 * followed by `npm test`, so a dev-only dependency on a sibling package still
 * has to exist on the registry (at the right version) for the workflow to pass.
 */
const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];

const PACKAGE_DIRECTORIES = [
  ['src', 'implementations'],
  ['src', 'tools']
];

function listSubdirectories(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(dir, entry.name))
    .sort();
}

/**
 * A submodule has a `.git` file pointing into the superproject, a standalone
 * clone has a `.git` directory — either way only a repository root has one.
 */
function isGitRepositoryRoot(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

/**
 * Find every package in the workspace.
 *
 * @param {string} rootDir - repository root (the `vintasend` package itself)
 * @returns {Array<object>} one entry per package.json found
 */
function discoverWorkspacePackages(rootDir) {
  const candidates = [
    rootDir,
    ...PACKAGE_DIRECTORIES.flatMap(segments => listSubdirectories(path.join(rootDir, ...segments)))
  ];

  const packages = [];

  for (const dir of candidates) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;

    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (error) {
      throw new Error(`${path.relative(rootDir, packageJsonPath)} is not valid JSON: ${error.message}`);
    }
    if (!packageJson.name) continue;

    const dirName = path.basename(dir);
    const isTemplate = dirName === TEMPLATE_DIR_NAME;
    const isGitRoot = isGitRepositoryRoot(dir);
    const hasPublishWorkflow = fs.existsSync(path.join(dir, '.github', 'workflows', 'publish.yml'));

    packages.push({
      name: packageJson.name,
      dirName,
      dir,
      relPath: path.relative(rootDir, dir) || '.',
      packageJsonPath,
      packageJson,
      version: packageJson.version,
      isRoot: dir === rootDir,
      isTemplate,
      isPrivate: Boolean(packageJson.private),
      isGitRoot,
      hasPublishWorkflow,
      // The implementation template ships a publish.yml for the repositories it
      // scaffolds, but it lives inside this repository: GitHub never runs that
      // file and it has no tag namespace of its own, so it is never released.
      // The APIs and dashboards under src/tools are the other case — real
      // repositories that carry the release version but publish nothing.
      publishable: !packageJson.private && hasPublishWorkflow && isGitRoot && !isTemplate
    });
  }

  return packages;
}

/**
 * The names this workspace publishes itself — the set a dependency range has to
 * match to be rewritten during a version bump.
 */
function internalPackageNames(packages) {
  return new Set(packages.filter(pkg => !pkg.isTemplate).map(pkg => pkg.name));
}

/**
 * Annotate each package with the workspace packages it depends on.
 *
 * @param {Array<object>} packages
 * @param {Set<string>} [names] - names to treat as internal (defaults to `packages`)
 */
function buildDependencyGraph(packages, names) {
  const internal = names || new Set(packages.map(pkg => pkg.name));

  for (const pkg of packages) {
    const dependencies = new Map();

    for (const field of DEPENDENCY_FIELDS) {
      const declared = pkg.packageJson[field];
      if (!declared) continue;

      for (const [depName, range] of Object.entries(declared)) {
        if (depName === pkg.name) continue;
        if (!internal.has(depName)) continue;
        if (!dependencies.has(depName)) dependencies.set(depName, []);
        dependencies.get(depName).push({ field, range });
      }
    }

    pkg.dependencies = dependencies;
  }

  return packages;
}

/**
 * Group packages into waves: everything in wave N can be handled together once
 * every wave before it is done.
 *
 * This is the ordering the whole release hangs on. A repository is only pushed
 * once every workspace package it depends on is already on npm — otherwise the
 * push triggers a CI run whose `npm install` resolves a version that does not
 * exist yet, and the build fails every single time.
 */
function buildWaves(packages) {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const remaining = new Set(packages.map(pkg => pkg.name));
  const settled = new Set();
  const waves = [];

  while (remaining.size > 0) {
    const wave = [];

    for (const name of remaining) {
      const pkg = byName.get(name);
      const pending = [...pkg.dependencies.keys()].filter(dep => remaining.has(dep) && !settled.has(dep));
      if (pending.length === 0) wave.push(pkg);
    }

    if (wave.length === 0) {
      throw new Error(`Dependency cycle between packages: ${[...remaining].sort().join(', ')}`);
    }

    wave.sort((a, b) => (a.isRoot === b.isRoot ? a.name.localeCompare(b.name) : a.isRoot ? -1 : 1));
    for (const pkg of wave) {
      remaining.delete(pkg.name);
      settled.add(pkg.name);
    }
    waves.push(wave);
  }

  return waves;
}

export {
  DEPENDENCY_FIELDS,
  TEMPLATE_DIR_NAME,
  discoverWorkspacePackages,
  internalPackageNames,
  buildDependencyGraph,
  buildWaves
};
