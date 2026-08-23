#!/usr/bin/env node

/**
 * Release step 2 (GitHub Actions flow): tag and wait.
 *
 * Instead of publishing from the local machine, this script pushes the git tags
 * that trigger each repository's `.github/workflows/publish.yml`, then waits for
 * npm to serve the new version before moving on.
 *
 * Packages are released in dependency waves: the root `vintasend` package first,
 * then every package whose vintasend dependencies are all published, and so on
 * until nothing is left. That ordering matters because each publish workflow runs
 * `npm install` against the public registry — a dependent tagged too early
 * resolves a stale version (or fails outright).
 *
 * This script never commits, branches or pushes anything but tags. Release
 * commits are expected to be merged into each repository's default branch
 * already; preflight refuses to tag anything that isn't.
 *
 * It is safe to re-run: packages already published at the release version are
 * skipped, so an interrupted release resumes where it stopped.
 */

import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { readPackageJson } from './utils/package-updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const rootDir = path.join(__dirname, '..');
const implementationsDir = path.join(rootDir, 'src', 'implementations');
const toolsDir = path.join(rootDir, 'src', 'tools');

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies'];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
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

function logDetail(message) {
  log(`  ${message}`, 'gray');
}

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

const HELP = `
Usage: node scripts/release-tag.js [options]

Pushes the release tags that trigger each package's publish.yml workflow, in
dependency order, waiting for npm to serve each wave before tagging the next.

Options:
  --only=a,b          Only release these packages (by npm name or directory name)
  --skip=a,b          Skip these packages (by npm name or directory name)
  --dry-run           Run every check and print the plan, but push no tags
  --yes, -y           Don't ask for confirmation before pushing tags
  --timeout=<sec>     How long to wait for a package to appear on npm (default 1800)
  --poll=<sec>        Seconds between npm checks (default 15)
  --no-watch          Don't use the gh CLI to fail fast on failed workflow runs
  --allow-dirty       Tag even if a repository has uncommitted changes
  --allow-unpushed    Tag even if HEAD is not merged into the remote default branch
  --registry=<url>    npm registry to poll (default https://registry.npmjs.org/)
  --help, -h          Show this message
`.trim();

function parseArgs(argv) {
  const options = {
    only: new Set(),
    skip: new Set(),
    dryRun: false,
    yes: false,
    timeoutSeconds: 1800,
    pollSeconds: 15,
    watch: true,
    allowDirty: false,
    allowUnpushed: false,
    registry: 'https://registry.npmjs.org/',
    help: false
  };

  const collectList = (value, target) => {
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => target.add(item));
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const takeValue = flag => {
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
      if (arg === flag && argv[i + 1]) {
        i += 1;
        return argv[i];
      }
      return null;
    };

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--yes' || arg === '-y') {
      options.yes = true;
      continue;
    }
    if (arg === '--no-watch') {
      options.watch = false;
      continue;
    }
    if (arg === '--allow-dirty') {
      options.allowDirty = true;
      continue;
    }
    if (arg === '--allow-unpushed') {
      options.allowUnpushed = true;
      continue;
    }

    const only = takeValue('--only');
    if (only !== null) {
      collectList(only, options.only);
      continue;
    }

    const skip = takeValue('--skip');
    if (skip !== null) {
      collectList(skip, options.skip);
      continue;
    }

    const timeout = takeValue('--timeout');
    if (timeout !== null) {
      options.timeoutSeconds = Number(timeout);
      continue;
    }

    const poll = takeValue('--poll');
    if (poll !== null) {
      options.pollSeconds = Number(poll);
      continue;
    }

    const registry = takeValue('--registry');
    if (registry !== null) {
      options.registry = registry;
      continue;
    }

    logWarning(`Ignoring unknown option: ${arg}`);
  }

  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new Error('--timeout must be a positive number of seconds');
  }
  if (!Number.isFinite(options.pollSeconds) || options.pollSeconds <= 0) {
    throw new Error('--poll must be a positive number of seconds');
  }

  return options;
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

/**
 * Run a command, capturing output. Never throws: callers inspect `success`.
 * @param {string} command
 * @param {string} cwd
 */
function tryRun(command, cwd = rootDir) {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { success: true, output: output.trim(), stderr: '' };
  } catch (error) {
    return {
      success: false,
      output: (error.stdout || '').toString().trim(),
      stderr: (error.stderr || error.message || '').toString().trim()
    };
  }
}

function run(command, cwd = rootDir) {
  const result = tryRun(command, cwd);
  if (!result.success) {
    throw new Error(`Command failed: ${command}\n${result.stderr || result.output}`);
  }
  return result.output;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function commandExists(command) {
  return tryRun(`command -v ${command}`).success;
}

// ---------------------------------------------------------------------------
// Package discovery
// ---------------------------------------------------------------------------

function listSubdirectories(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(dir, dirent.name));
}

function isGitRepositoryRoot(dir) {
  const result = tryRun('git rev-parse --show-toplevel', dir);
  if (!result.success) return false;
  try {
    return fs.realpathSync(result.output) === fs.realpathSync(dir);
  } catch {
    return false;
  }
}

/**
 * Turn a git remote URL into an `owner/repo` slug, or null for non-GitHub remotes.
 * @param {string} remoteUrl
 */
function parseGitHubSlug(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Find every package that releases through its own publish.yml workflow.
 *
 * A package qualifies when it has a package.json, is not private, ships
 * `.github/workflows/publish.yml`, and is the root of its own git repository.
 * That last condition is what excludes `vintasend-implementation-template`:
 * it lives inside this repository, so GitHub never runs the workflow file it
 * carries for scaffolding purposes, and it has no tag namespace of its own.
 */
function discoverPackages() {
  const candidates = [rootDir, ...listSubdirectories(implementationsDir), ...listSubdirectories(toolsDir)];
  const packages = [];

  for (const dir of candidates) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;
    if (!fs.existsSync(path.join(dir, '.github', 'workflows', 'publish.yml'))) continue;
    if (!isGitRepositoryRoot(dir)) continue;

    const packageJson = readPackageJson(packageJsonPath);
    if (packageJson.private) continue;

    const remote = tryRun('git remote get-url origin', dir);

    packages.push({
      name: packageJson.name,
      dirName: path.basename(dir),
      dir,
      isRoot: dir === rootDir,
      version: packageJson.version,
      tag: `v${packageJson.version}`,
      packageJson,
      repoSlug: remote.success ? parseGitHubSlug(remote.output) : null
    });
  }

  return packages;
}

/**
 * Map each package to the released packages it depends on.
 *
 * devDependencies count: the publish workflow runs `npm install` followed by
 * `npm test`, so a package's dev-only dependency on another released package
 * still has to exist on the registry before its workflow can succeed.
 */
function buildDependencyGraph(packages) {
  const releasedNames = new Set(packages.map(pkg => pkg.name));

  for (const pkg of packages) {
    const dependencies = new Map();

    for (const field of DEPENDENCY_FIELDS) {
      const declared = pkg.packageJson[field];
      if (!declared) continue;

      for (const [depName, range] of Object.entries(declared)) {
        if (depName === pkg.name) continue;
        if (!releasedNames.has(depName)) continue;
        if (!dependencies.has(depName)) {
          dependencies.set(depName, []);
        }
        dependencies.get(depName).push({ field, range });
      }
    }

    pkg.dependencies = dependencies;
  }

  return packages;
}

/**
 * Group packages into waves: everything in wave N can be tagged in parallel once
 * every wave before it is on npm.
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
      throw new Error(
        `Dependency cycle between released packages: ${[...remaining].sort().join(', ')}`
      );
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

// ---------------------------------------------------------------------------
// npm
// ---------------------------------------------------------------------------

/**
 * Is this exact version already on the registry?
 * @returns {{published: boolean, error: string|null}}
 */
function isVersionPublished(pkg, options) {
  const spec = `${pkg.name}@${pkg.version}`;
  const result = tryRun(`npm view ${spec} version --registry=${options.registry} --json`, pkg.dir);

  if (result.success) {
    return { published: result.output.replace(/"/g, '').trim() === pkg.version, error: null };
  }

  const message = `${result.stderr}\n${result.output}`;
  // A missing package or version is the expected "not published yet" answer.
  if (/E404|is not in this registry|No match(ing version)? found/i.test(message)) {
    return { published: false, error: null };
  }
  return { published: false, error: result.stderr || result.output };
}

// ---------------------------------------------------------------------------
// GitHub Actions
// ---------------------------------------------------------------------------

const FAILED_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'startup_failure', 'action_required']);

/**
 * Look up the publish workflow run for a pushed tag. Returns null when the gh
 * CLI can't answer (not installed, not authenticated, run not created yet).
 */
function getWorkflowRun(pkg) {
  if (!pkg.repoSlug) return null;

  const result = tryRun(
    `gh run list --repo ${pkg.repoSlug} --workflow publish.yml --branch ${pkg.tag} ` +
      '--limit 1 --json databaseId,status,conclusion,url',
    pkg.dir
  );
  if (!result.success) return null;

  try {
    const runs = JSON.parse(result.output);
    return runs.length > 0 ? runs[0] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

/**
 * Resolve the remote-tracking ref a release commit is expected to live on.
 */
function getRemoteDefaultBranchRef(dir) {
  const symbolic = tryRun('git symbolic-ref --quiet refs/remotes/origin/HEAD', dir);
  if (symbolic.success && symbolic.output) {
    return symbolic.output.replace('refs/remotes/', '');
  }

  const upstream = tryRun('git rev-parse --abbrev-ref --symbolic-full-name @{u}', dir);
  if (upstream.success && upstream.output) {
    return upstream.output;
  }

  return 'origin/main';
}

/**
 * Verify a package can be tagged, and gather the facts the plan needs.
 * Fatal problems land in `errors`; recoverable ones in `warnings`.
 */
function preflightPackage(pkg, options) {
  const errors = [];
  const warnings = [];

  if (!pkg.repoSlug) {
    warnings.push('origin is not a GitHub remote — workflow runs cannot be watched');
  }

  const fetch = tryRun('git fetch origin --tags --prune --quiet', pkg.dir);
  if (!fetch.success) {
    warnings.push(`git fetch origin failed: ${fetch.stderr.split('\n')[0]}`);
  }

  const status = tryRun('git status --porcelain', pkg.dir);
  if (!status.success) {
    errors.push(`git status failed: ${status.stderr}`);
    return { errors, warnings };
  }
  const dirty = status.output.length > 0;
  if (dirty) {
    const message = `working tree has uncommitted changes (${status.output.split('\n').length} entries)`;
    if (options.allowDirty) warnings.push(message);
    else errors.push(`${message} — commit and merge them, or pass --allow-dirty`);
  }

  const headSha = tryRun('git rev-parse HEAD', pkg.dir);
  if (!headSha.success) {
    errors.push('could not resolve HEAD');
    return { errors, warnings };
  }
  pkg.headSha = headSha.output;

  // The workflow checks out the tag and asserts the tag matches package.json,
  // so compare against the committed file rather than the working tree.
  const committedPackageJson = tryRun('git show HEAD:package.json', pkg.dir);
  if (!committedPackageJson.success) {
    errors.push('HEAD has no package.json');
  } else {
    let committedVersion = null;
    try {
      committedVersion = JSON.parse(committedPackageJson.output).version;
    } catch {
      errors.push('HEAD package.json is not valid JSON');
    }
    if (committedVersion && committedVersion !== pkg.version) {
      errors.push(
        `HEAD package.json is version ${committedVersion} but the working tree says ${pkg.version} — ` +
          'commit the version bump before tagging'
      );
    }
  }

  // A commit that never reached the default branch means the tag would point at
  // unreviewed work — and at a commit nobody else can see.
  const remoteRef = getRemoteDefaultBranchRef(pkg.dir);
  pkg.remoteRef = remoteRef;
  const merged = tryRun(`git merge-base --is-ancestor ${pkg.headSha} ${remoteRef}`, pkg.dir);
  if (!merged.success) {
    const message = `HEAD is not an ancestor of ${remoteRef} — push/merge the release commit first`;
    if (options.allowUnpushed) warnings.push(message);
    else errors.push(`${message} (or pass --allow-unpushed)`);
  }

  const localTag = tryRun(`git rev-parse --quiet --verify refs/tags/${pkg.tag}`, pkg.dir);
  pkg.localTagSha = localTag.success && localTag.output ? localTag.output : null;

  const remoteTag = tryRun(`git ls-remote --tags origin refs/tags/${pkg.tag}`, pkg.dir);
  pkg.remoteTagSha = remoteTag.success && remoteTag.output ? remoteTag.output.split(/\s+/)[0] : null;

  if (pkg.localTagSha && pkg.localTagSha !== pkg.headSha) {
    errors.push(`local tag ${pkg.tag} points at ${pkg.localTagSha.slice(0, 8)}, not HEAD`);
  }
  if (pkg.remoteTagSha && pkg.remoteTagSha !== pkg.headSha) {
    errors.push(`remote tag ${pkg.tag} already points at ${pkg.remoteTagSha.slice(0, 8)}, not HEAD`);
  }

  return { errors, warnings };
}

/**
 * Flag dependency ranges that can't be satisfied by the version being released.
 *
 * A cheap literal check rather than full semver resolution: it catches the
 * common case of a package left pointing at an older line (`^0.14.1`) while the
 * release publishes something else entirely.
 */
function checkDependencyRanges(packages) {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const warnings = [];

  for (const pkg of packages) {
    for (const [depName, declarations] of pkg.dependencies) {
      const dep = byName.get(depName);
      if (!dep) continue;

      // Report each field separately: a package can easily end up with a bumped
      // devDependency while its peerDependency still points at the previous line.
      for (const { field, range } of declarations) {
        if (range.includes(dep.version)) continue;
        warnings.push(
          `${pkg.name} declares ${depName}@${range} in ${field}, ` +
            `but this release publishes ${depName}@${dep.version}`
        );
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Tag and wait
// ---------------------------------------------------------------------------

function pushTag(pkg, options) {
  if (options.dryRun) {
    logInfo(`[dry-run] would tag ${pkg.tag} at ${pkg.headSha.slice(0, 8)} and push it to origin`);
    return;
  }

  if (pkg.remoteTagSha === pkg.headSha) {
    logInfo(`${pkg.tag} is already on origin — not re-pushing`);
    return;
  }

  if (!pkg.localTagSha) {
    run(`git tag -a ${pkg.tag} -m "Release ${pkg.name}@${pkg.version}"`, pkg.dir);
    logDetail(`created tag ${pkg.tag} at ${pkg.headSha.slice(0, 8)}`);
  }

  run(`git push origin refs/tags/${pkg.tag}`, pkg.dir);
  logSuccess(`Pushed ${pkg.tag} to ${pkg.repoSlug || 'origin'}`);
}

/**
 * Poll npm until the version shows up, failing early if the workflow run that
 * should produce it has already failed.
 */
async function waitForPublish(pkg, options) {
  const deadline = Date.now() + options.timeoutSeconds * 1000;
  let lastStatus = null;
  let reportedRunUrl = false;

  while (Date.now() < deadline) {
    const { published, error } = isVersionPublished(pkg, options);
    if (published) {
      return { success: true };
    }
    if (error) {
      logWarning(`${pkg.name}: registry check failed (${error.split('\n')[0]}) — retrying`);
    }

    if (options.watch && pkg.repoSlug) {
      const workflowRun = getWorkflowRun(pkg);
      if (workflowRun) {
        if (!reportedRunUrl) {
          logDetail(`${pkg.name}: ${workflowRun.url}`);
          reportedRunUrl = true;
        }
        const state = workflowRun.conclusion || workflowRun.status;
        if (state !== lastStatus) {
          lastStatus = state;
          if (workflowRun.status === 'waiting') {
            logWarning(`${pkg.name}: workflow is waiting for approval on the "npm" environment`);
          } else {
            logDetail(`${pkg.name}: workflow ${state}`);
          }
        }
        if (workflowRun.conclusion && FAILED_CONCLUSIONS.has(workflowRun.conclusion)) {
          return {
            success: false,
            reason: `publish workflow ${workflowRun.conclusion}: ${workflowRun.url}`
          };
        }
      }
    }

    await sleep(options.pollSeconds * 1000);
  }

  return {
    success: false,
    reason: `timed out after ${options.timeoutSeconds}s waiting for ${pkg.name}@${pkg.version} on npm`
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = query => new Promise(resolve => rl.question(query, resolve));

  try {
    log('\n========================================', 'bright');
    log('  VintaSend Release - Tag & Watch', 'bright');
    log('========================================\n', 'bright');
    if (options.dryRun) {
      logWarning('Dry run: no tags will be created or pushed');
    }

    // Step 1: discover packages that publish through GitHub Actions
    logStep('1', 'Discovering packages with a publish.yml workflow...');
    const discovered = buildDependencyGraph(discoverPackages());
    if (discovered.length === 0) {
      logError('No releasable packages found');
      process.exitCode = 1;
      return;
    }
    for (const pkg of discovered) {
      logDetail(`${pkg.name}@${pkg.version} (${path.relative(rootDir, pkg.dir) || '.'})`);
    }
    logSuccess(`Found ${discovered.length} packages`);

    // Step 2: apply --only / --skip
    logStep('2', 'Applying selection filters...');
    const matches = (pkg, names) => names.has(pkg.name) || names.has(pkg.dirName) ||
      (pkg.isRoot && (names.has('root') || names.has('main')));

    const knownNames = new Set(['root', 'main', ...discovered.flatMap(pkg => [pkg.name, pkg.dirName])]);
    for (const name of [...options.only, ...options.skip]) {
      if (!knownNames.has(name)) logWarning(`Unknown package name in filters: ${name}`);
    }

    let selected = discovered;
    if (options.only.size > 0) {
      selected = selected.filter(pkg => matches(pkg, options.only));
    }
    if (options.skip.size > 0) {
      selected = selected.filter(pkg => !matches(pkg, options.skip));
    }
    if (selected.length === 0) {
      logError('Every package was filtered out');
      process.exitCode = 1;
      return;
    }
    if (selected.length !== discovered.length) {
      logInfo(`Releasing ${selected.length} of ${discovered.length} packages`);
    } else {
      logSuccess('Releasing all discovered packages');
    }

    // Dependencies left out of the selection have to be on npm already,
    // otherwise the skipped package's workflow would install a stale version.
    const selectedNames = new Set(selected.map(pkg => pkg.name));
    const excludedDependencies = [];
    for (const pkg of selected) {
      for (const depName of pkg.dependencies.keys()) {
        if (!selectedNames.has(depName)) excludedDependencies.push({ pkg, depName });
      }
    }
    for (const { pkg, depName } of excludedDependencies) {
      const dep = discovered.find(candidate => candidate.name === depName);
      const { published } = isVersionPublished(dep, options);
      if (published) {
        logDetail(`${depName}@${dep.version} is excluded but already published`);
      } else {
        logError(`${pkg.name} depends on ${depName}@${dep.version}, which is excluded and not published`);
        process.exitCode = 1;
        return;
      }
    }

    // Step 3: order into dependency waves
    logStep('3', 'Ordering packages into dependency waves...');
    const waves = buildWaves(selected);
    waves.forEach((wave, index) => {
      log(`  Wave ${index + 1}: ${wave.map(pkg => pkg.name).join(', ')}`, 'blue');
      for (const pkg of wave) {
        const deps = [...pkg.dependencies.keys()];
        if (deps.length > 0) logDetail(`  ${pkg.name} waits for ${deps.join(', ')}`);
      }
    });

    // Step 4: preflight every repository before touching any of them
    logStep('4', 'Running preflight checks...');
    const blocking = [];
    for (const pkg of selected) {
      const { errors, warnings } = preflightPackage(pkg, options);
      const { published, error } = isVersionPublished(pkg, options);
      if (error) {
        logWarning(`${pkg.name}: could not reach the registry (${error.split('\n')[0]})`);
      }
      pkg.alreadyPublished = published;

      if (published) {
        // Nothing to do for this one; its git state no longer matters.
        logInfo(`${pkg.name}@${pkg.version} is already on npm — will skip`);
        continue;
      }
      for (const warning of warnings) logWarning(`${pkg.name}: ${warning}`);
      for (const problem of errors) {
        logError(`${pkg.name}: ${problem}`);
        blocking.push(`${pkg.name}: ${problem}`);
      }
      if (errors.length === 0) {
        logSuccess(`${pkg.name}@${pkg.version} ready to tag ${pkg.tag} at ${pkg.headSha.slice(0, 8)}`);
      }
    }

    for (const warning of checkDependencyRanges(selected)) {
      logWarning(warning);
    }

    if (blocking.length > 0) {
      log('');
      logError(`${blocking.length} preflight problem(s) — nothing was tagged`);
      process.exitCode = 1;
      return;
    }

    const pending = selected.filter(pkg => !pkg.alreadyPublished);
    if (pending.length === 0) {
      log('');
      logSuccess('Every selected package is already published — nothing to do');
      return;
    }

    if (options.watch && !commandExists('gh')) {
      logWarning('gh CLI not found — falling back to registry polling only');
      options.watch = false;
    }

    // Step 5: confirm
    logStep('5', 'Release plan');
    waves.forEach((wave, index) => {
      const todo = wave.filter(pkg => !pkg.alreadyPublished);
      if (todo.length === 0) return;
      log(`  Wave ${index + 1}`, 'bright');
      for (const pkg of todo) {
        logDetail(`push ${pkg.tag} to ${pkg.repoSlug || 'origin'} → publishes ${pkg.name}@${pkg.version}`);
      }
    });

    if (!options.yes && !options.dryRun) {
      const answer = await question('\nPush these tags? (yes/no): ');
      if (!['y', 'yes'].includes(answer.trim().toLowerCase())) {
        logWarning('Aborted — no tags were pushed');
        return;
      }
    }

    // Step 6: tag wave by wave, waiting for npm in between
    const published = [];
    const skipped = [];

    for (let index = 0; index < waves.length; index++) {
      const wave = waves[index];
      const todo = wave.filter(pkg => !pkg.alreadyPublished);
      const done = wave.filter(pkg => pkg.alreadyPublished);
      done.forEach(pkg => skipped.push(pkg));

      if (todo.length === 0) continue;

      log(`\n${'─'.repeat(60)}`, 'cyan');
      log(`Wave ${index + 1}/${waves.length}: ${todo.map(pkg => pkg.name).join(', ')}`, 'bright');
      log('─'.repeat(60), 'cyan');

      for (const pkg of todo) {
        pushTag(pkg, options);
      }

      if (options.dryRun) {
        logInfo('[dry-run] would now wait for these versions to appear on npm');
        continue;
      }

      logInfo(`Waiting for ${todo.length} package(s) to reach npm (timeout ${options.timeoutSeconds}s)...`);
      const results = await Promise.all(
        todo.map(async pkg => ({ pkg, result: await waitForPublish(pkg, options) }))
      );

      const failures = [];
      for (const { pkg, result } of results) {
        if (result.success) {
          logSuccess(`${pkg.name}@${pkg.version} is live on npm`);
          published.push(pkg);
        } else {
          logError(`${pkg.name}@${pkg.version}: ${result.reason}`);
          failures.push(pkg);
        }
      }

      if (failures.length > 0) {
        log('');
        logError('Stopping: later waves depend on this one.');
        logInfo('Fix the failed workflow(s), then re-run this script — published packages are skipped.');
        process.exitCode = 1;
        return;
      }
    }

    // Summary
    log(`\n${'='.repeat(50)}`, 'green');
    log(options.dryRun ? '✓ DRY RUN COMPLETED' : '✓ RELEASE COMPLETED SUCCESSFULLY!', 'green');
    log('='.repeat(50), 'green');
    if (!options.dryRun) {
      console.log(`\nPackages published: ${published.length}`);
      if (skipped.length > 0) {
        console.log(`Already published (skipped): ${skipped.length}`);
      }
      console.log('\nNext steps:');
      console.log('  1. Update the submodule pointers in the root repo if they moved');
      console.log('  2. Draft the GitHub releases for the new tags');
      console.log('');
    }
  } catch (error) {
    logError(`\nError: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
