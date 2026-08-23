#!/usr/bin/env node

/**
 * Release step 2 (GitHub Actions flow): commit, push, tag and wait.
 *
 * Instead of publishing from the local machine, this script pushes the git tags
 * that trigger each repository's `.github/workflows/publish.yml`, then waits for
 * npm to serve the new version before moving on.
 *
 * Everything happens in dependency waves: the root `vintasend` package first,
 * then every package whose vintasend dependencies are all published, and so on
 * until nothing is left. A repository is only pushed once every workspace
 * package it depends on is already on npm. That ordering is what keeps CI
 * green: both `ci.yml` (on the branch push) and `publish.yml` (on the tag push)
 * run `npm install`, so a repository pushed too early resolves a version that
 * does not exist yet and fails every time.
 *
 * With `--commit` the script also creates the release commits, in the same wave
 * order. Two repositories need special handling there:
 *
 *   - The root repository is both the `vintasend` package and the superproject
 *     holding every submodule. Its release commit deliberately excludes the
 *     submodule pointers, because at that moment the submodules have not been
 *     committed yet. A final commit at the end of the run syncs the pointers.
 *   - The APIs and dashboards under `src/tools` carry the release version but
 *     publish nothing (no publish.yml). They are committed and pushed after
 *     every published package is live.
 *
 * It is safe to re-run: packages already published at the release version are
 * skipped, and repositories with nothing to commit are left alone, so an
 * interrupted release resumes where it stopped.
 */

import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  discoverWorkspacePackages,
  internalPackageNames,
  buildDependencyGraph,
  buildWaves
} from './utils/workspace-packages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const rootDir = path.join(__dirname, '..');

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

Walks the workspace in dependency order and, one wave at a time, pushes the
release tags that trigger each package's publish.yml workflow, waiting for npm
to serve the wave before touching the next one.

Options:
  --only=a,b          Only release these packages (by npm name or directory name)
  --skip=a,b          Skip these packages (by npm name or directory name)
  --dry-run           Run every check and print the plan, but change nothing
  --yes, -y           Don't ask for confirmation
  --commit            Commit and push each repository's release commit as its wave runs
  --commit-message=<msg>
                      Message for those commits (default "Release <name>@<version>")
  --no-verify         Pass --no-verify to git commit (skip husky hooks)
  --no-push-commit    Create the --commit commits but don't push them (implies --allow-unpushed)
  --no-companions     Don't commit/push the repositories that publish nothing
  --no-submodule-sync Don't make the final submodule-pointer commit in the root repo
  --timeout=<sec>     How long to wait for a package to appear on npm (default 1800)
  --poll=<sec>        Seconds between npm checks (default 15)
  --settle=<sec>      Pause after a wave is live, before pushing the next (default 20)
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
    commit: false,
    commitMessage: null,
    noVerify: false,
    pushCommit: true,
    companions: true,
    submoduleSync: true,
    timeoutSeconds: 1800,
    pollSeconds: 15,
    settleSeconds: 20,
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

  const FLAGS = {
    '--help': () => { options.help = true; },
    '-h': () => { options.help = true; },
    '--dry-run': () => { options.dryRun = true; },
    '--yes': () => { options.yes = true; },
    '-y': () => { options.yes = true; },
    '--no-watch': () => { options.watch = false; },
    '--allow-dirty': () => { options.allowDirty = true; },
    '--allow-unpushed': () => { options.allowUnpushed = true; },
    '--commit': () => { options.commit = true; },
    '--no-verify': () => { options.noVerify = true; },
    '--no-push-commit': () => { options.pushCommit = false; },
    '--no-companions': () => { options.companions = false; },
    '--no-submodule-sync': () => { options.submoduleSync = false; }
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

    if (FLAGS[arg]) {
      FLAGS[arg]();
      continue;
    }

    const commitMessage = takeValue('--commit-message');
    if (commitMessage !== null) {
      options.commitMessage = commitMessage;
      options.commit = true;
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

    const settle = takeValue('--settle');
    if (settle !== null) {
      options.settleSeconds = Number(settle);
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
  if (!Number.isFinite(options.settleSeconds) || options.settleSeconds < 0) {
    throw new Error('--settle must be zero or a positive number of seconds');
  }

  // A commit that is never pushed can't be an ancestor of the remote default
  // branch, so the ancestor check would block every tag. Relax it rather than
  // failing halfway through the run.
  if (options.commit && !options.pushCommit) {
    options.allowUnpushed = true;
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

/** Quote a value for use as a single shell argument. */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// ---------------------------------------------------------------------------
// Package discovery
// ---------------------------------------------------------------------------

/**
 * Turn a git remote URL into an `owner/repo` slug, or null for non-GitHub remotes.
 * @param {string} remoteUrl
 */
function parseGitHubSlug(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Every workspace package, annotated with the git facts the release needs.
 *
 * Packages split into three roles:
 *   - `publishable`: own repository + publish.yml → gets a tag and a wait
 *   - companions: own repository, no publish.yml (the APIs and dashboards) →
 *     committed and pushed, never tagged
 *   - the implementation template: lives inside the root repository, so its
 *     changes ride along in the root commit
 */
function discoverPackages() {
  const packages = discoverWorkspacePackages(rootDir);

  for (const pkg of packages) {
    pkg.tag = `v${pkg.version}`;
    const remote = pkg.isGitRoot ? tryRun('git remote get-url origin', pkg.dir) : { success: false };
    pkg.repoSlug = remote.success ? parseGitHubSlug(remote.output) : null;
  }

  return packages;
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
// Commit and push
// ---------------------------------------------------------------------------

/**
 * The submodule paths recorded in a repository's .gitmodules.
 */
function getSubmodulePaths(dir) {
  const result = tryRun('git config --file .gitmodules --get-regexp "^submodule\\..*\\.path$"', dir);
  if (!result.success || !result.output) return [];
  return result.output
    .split('\n')
    .map(line => line.split(/\s+/).slice(1).join(' ').trim())
    .filter(Boolean)
    .sort();
}

function currentBranch(dir) {
  const branch = tryRun('git rev-parse --abbrev-ref HEAD', dir);
  if (!branch.success || !branch.output || branch.output === 'HEAD') return null;
  return branch.output;
}

function workingTreeEntries(dir) {
  const status = tryRun('git status --porcelain', dir);
  if (!status.success) return null;
  return status.output ? status.output.split('\n') : [];
}

/**
 * The working tree changes that actually block a release.
 *
 * `--ignore-submodules=all` drops the gitlink entries, which is what makes the
 * root repository releasable: its submodule pointers move as each submodule is
 * committed during this very run, and they are recorded by the final sync
 * commit. They never affect what the root package publishes either way.
 */
function releaseDirtyEntries(dir) {
  const status = tryRun('git status --porcelain --ignore-submodules=all', dir);
  if (!status.success) return null;
  return status.output ? status.output.split('\n') : [];
}

/** `git diff --cached --quiet` exits non-zero exactly when something is staged. */
function hasStagedChanges(dir) {
  return !tryRun('git diff --cached --quiet', dir).success;
}

/**
 * Stage and commit a repository's working tree.
 *
 * @param {object} pkg
 * @param {object} options
 * @param {{message?: string, pathspec?: string, describe?: string}} [config]
 * @returns {boolean} true when a commit was created
 */
function commitRepository(pkg, options, config = {}) {
  const dir = pkg.dir;
  const entries = workingTreeEntries(dir);
  if (entries === null) throw new Error(`${pkg.name}: git status failed`);
  if (entries.length === 0) return false;

  const pathspec = config.pathspec || '-A -- .';
  const message = config.message || options.commitMessage || `Release ${pkg.name}@${pkg.version}`;

  if (options.dryRun) {
    logInfo(`[dry-run] would commit in ${pkg.relPath}: "${message}"`);
    entries.slice(0, 8).forEach(entry => logDetail(entry));
    if (entries.length > 8) logDetail(`… and ${entries.length - 8} more`);
    return false;
  }

  if (!currentBranch(dir)) {
    throw new Error(`${pkg.name}: cannot commit from a detached HEAD`);
  }

  run(`git add ${pathspec}`, dir);
  if (!hasStagedChanges(dir)) {
    logDetail(`${pkg.name}: nothing to stage${config.describe ? ` (${config.describe})` : ''}`);
    return false;
  }

  const verify = options.noVerify ? '--no-verify ' : '';
  run(`git commit ${verify}-m ${shellQuote(message)}`, dir);
  logSuccess(`${pkg.name}: committed "${message}"`);
  return true;
}

/**
 * Push the current branch. This is the step whose timing matters: it starts the
 * repository's CI run, so it must not happen before the packages it depends on
 * are on npm.
 *
 * @returns {boolean} true when something was pushed
 */
function pushBranch(pkg, options) {
  if (!options.pushCommit) {
    logWarning(`${pkg.name}: --no-push-commit, leaving the branch local`);
    return false;
  }

  const branch = currentBranch(pkg.dir);
  if (!branch) throw new Error(`${pkg.name}: cannot push from a detached HEAD`);

  // Checked before "is anything to push": a dry run never made the commit, so
  // reporting the branch as up to date would hide what the real run would do.
  if (options.dryRun) {
    logInfo(`[dry-run] would push ${branch} to ${pkg.repoSlug || 'origin'}`);
    return false;
  }

  const ahead = tryRun(`git rev-list --count origin/${branch}..HEAD`, pkg.dir);
  if (ahead.success && ahead.output === '0') {
    logDetail(`${pkg.name}: ${branch} already matches origin`);
    return false;
  }

  run(`git push origin HEAD:refs/heads/${branch}`, pkg.dir);
  logSuccess(`${pkg.name}: pushed ${branch} to ${pkg.repoSlug || 'origin'}`);
  return true;
}

/**
 * Commit and push one repository's release commit.
 *
 * The root repository excludes its submodule pointers: when its wave runs the
 * submodules have not been committed yet, so staging them would record stale
 * pointers and force a second corrective commit. `syncSubmodulePointers` picks
 * them up once every submodule is done.
 */
function commitAndPush(pkg, options) {
  let pathspec = '-A -- .';
  let describe;

  if (pkg.isRoot) {
    const submodules = getSubmodulePaths(pkg.dir);
    if (submodules.length > 0) {
      pathspec = `-A -- . ${submodules.map(sub => shellQuote(`:(exclude)${sub}`)).join(' ')}`;
      describe = 'submodule pointers are committed at the end of the run';
    }
  }

  const committed = commitRepository(pkg, options, { pathspec, describe });
  const pushed = pushBranch(pkg, options);
  return { committed, pushed };
}

/**
 * Record the submodule commits made during this release in the root repository.
 *
 * This is the second root commit the old flow needed by hand: every submodule
 * release commit moves the pointer the superproject stores, and those moves are
 * only knowable once the submodules have been committed.
 */
function submodulePointerEntries(pkg) {
  const submodules = getSubmodulePaths(pkg.dir);
  if (submodules.length === 0) return [];

  const moved = tryRun(`git status --porcelain -- ${submodules.map(shellQuote).join(' ')}`, pkg.dir);
  if (!moved.success) throw new Error(`${pkg.name}: git status failed while checking submodule pointers`);
  return moved.output ? moved.output.split('\n') : [];
}

function syncSubmodulePointers(rootPkg, options, version) {
  const submodules = getSubmodulePaths(rootPkg.dir);
  if (submodules.length === 0) return false;

  const paths = submodules.map(shellQuote).join(' ');
  const moved = submodulePointerEntries(rootPkg);
  if (moved.length === 0) {
    logSuccess('Submodule pointers are already up to date');
    return false;
  }

  for (const entry of moved) logDetail(entry);

  const message = `chore: update submodule pointers for v${version}`;
  if (options.dryRun) {
    logInfo(`[dry-run] would commit in the root repo: "${message}"`);
    return false;
  }

  run(`git add -- ${paths}`, rootPkg.dir);
  if (!hasStagedChanges(rootPkg.dir)) {
    logDetail('root: nothing to stage for the submodule pointers');
    return false;
  }

  const verify = options.noVerify ? '--no-verify ' : '';
  run(`git commit ${verify}-m ${shellQuote(message)}`, rootPkg.dir);
  logSuccess(`root: committed "${message}"`);
  pushBranch(rootPkg, options);
  return true;
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
 *
 * Fatal problems land in `errors`, recoverable ones in `warnings`. With
 * `fixable` set — the pre-check pass of a `--commit` run — the three problems
 * that the commit step is about to resolve (a dirty tree, a version that is
 * only in the working tree, a HEAD that is not on the remote yet) are reported
 * as pending work instead of blocking the run before it starts.
 *
 * @param {object} pkg
 * @param {object} options
 * @param {{fixable?: boolean}} [mode]
 */
function preflightPackage(pkg, options, mode = {}) {
  const errors = [];
  const warnings = [];
  const pending = [];

  const willFix = Boolean(mode.fixable && options.commit);
  const report = (message, hint) => {
    if (willFix) pending.push(message);
    else if (hint === 'dirty' && options.allowDirty) warnings.push(message);
    else if (hint === 'unpushed' && options.allowUnpushed) warnings.push(message);
    else errors.push(message);
  };

  if (!pkg.repoSlug) {
    warnings.push('origin is not a GitHub remote — workflow runs cannot be watched');
  }

  const fetch = tryRun('git fetch origin --tags --prune --quiet', pkg.dir);
  if (!fetch.success) {
    warnings.push(`git fetch origin failed: ${fetch.stderr.split('\n')[0]}`);
  }

  const entries = releaseDirtyEntries(pkg.dir);
  if (entries === null) {
    errors.push('git status failed');
    return { errors, warnings, pending };
  }
  if (entries.length > 0) {
    report(`working tree has uncommitted changes (${entries.length} entries)` +
      (willFix ? '' : ' — commit and merge them, or pass --allow-dirty'), 'dirty');
  }

  const headSha = tryRun('git rev-parse HEAD', pkg.dir);
  if (!headSha.success) {
    errors.push('could not resolve HEAD');
    return { errors, warnings, pending };
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
      report(
        `HEAD package.json is version ${committedVersion} but the working tree says ${pkg.version}` +
          (willFix ? '' : ' — commit the version bump before tagging'),
        'dirty'
      );
    }
  }

  // A commit that never reached the default branch means the tag would point at
  // unreviewed work — and at a commit nobody else can see.
  const remoteRef = getRemoteDefaultBranchRef(pkg.dir);
  pkg.remoteRef = remoteRef;
  const merged = tryRun(`git merge-base --is-ancestor ${pkg.headSha} ${remoteRef}`, pkg.dir);
  if (!merged.success) {
    report(
      `HEAD is not an ancestor of ${remoteRef}` +
        (willFix ? '' : ' — push/merge the release commit first (or pass --allow-unpushed)'),
      'unpushed'
    );
  }

  const localTag = tryRun(`git rev-parse --quiet --verify refs/tags/${pkg.tag}`, pkg.dir);
  pkg.localTagSha = localTag.success && localTag.output ? localTag.output : null;

  const remoteTag = tryRun(`git ls-remote --tags origin refs/tags/${pkg.tag}`, pkg.dir);
  pkg.remoteTagSha = remoteTag.success && remoteTag.output ? remoteTag.output.split(/\s+/)[0] : null;

  // A tag that already exists somewhere else is never fixable by committing:
  // the release version has already been used for a different commit.
  if (pkg.localTagSha && pkg.localTagSha !== pkg.headSha && !willFix) {
    errors.push(`local tag ${pkg.tag} points at ${pkg.localTagSha.slice(0, 8)}, not HEAD`);
  }
  if (pkg.remoteTagSha && pkg.remoteTagSha !== pkg.headSha) {
    const message = `remote tag ${pkg.tag} already points at ${pkg.remoteTagSha.slice(0, 8)}, not HEAD`;
    // Under --commit the local HEAD is about to move, so only a remote tag that
    // is already published is worth stopping for at pre-check time.
    if (willFix) warnings.push(`${message} (it will have to match after the release commit)`);
    else errors.push(message);
  }

  return { errors, warnings, pending };
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
    log('  VintaSend Release - Commit, Tag & Watch', 'bright');
    log('========================================\n', 'bright');
    if (options.dryRun) {
      logWarning('Dry run: nothing will be committed, tagged or pushed');
    }

    // Step 1: discover the workspace
    logStep('1', 'Discovering workspace packages...');
    const workspace = discoverPackages();
    const internalNames = internalPackageNames(workspace);
    buildDependencyGraph(workspace, internalNames);

    const discovered = workspace.filter(pkg => pkg.publishable);
    const allCompanions = workspace.filter(pkg => !pkg.publishable && !pkg.isTemplate && pkg.isGitRoot);
    const rootPkg = workspace.find(pkg => pkg.isRoot);

    if (discovered.length === 0) {
      logError('No releasable packages found');
      process.exitCode = 1;
      return;
    }
    for (const pkg of discovered) {
      logDetail(`${pkg.name}@${pkg.version} (${pkg.relPath})`);
    }
    logSuccess(`Found ${discovered.length} publishable packages`);
    if (allCompanions.length > 0) {
      logInfo(`${allCompanions.length} repositories carry the version but publish nothing:`);
      for (const pkg of allCompanions) logDetail(`${pkg.name}@${pkg.version} (${pkg.relPath})`);
    }

    // Step 2: apply --only / --skip
    logStep('2', 'Applying selection filters...');
    const matches = (pkg, names) => names.has(pkg.name) || names.has(pkg.dirName) ||
      (pkg.isRoot && (names.has('root') || names.has('main')));

    const knownNames = new Set([
      'root',
      'main',
      ...workspace.flatMap(pkg => [pkg.name, pkg.dirName])
    ]);
    for (const name of [...options.only, ...options.skip]) {
      if (!knownNames.has(name)) logWarning(`Unknown package name in filters: ${name}`);
    }

    const applyFilters = list => {
      let result = list;
      if (options.only.size > 0) result = result.filter(pkg => matches(pkg, options.only));
      if (options.skip.size > 0) result = result.filter(pkg => !matches(pkg, options.skip));
      return result;
    };

    const selected = applyFilters(discovered);
    const companions = options.companions ? applyFilters(allCompanions) : [];
    if (selected.length === 0) {
      logError('Every publishable package was filtered out');
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
    for (const pkg of [...selected, ...companions]) {
      for (const depName of pkg.dependencies.keys()) {
        if (!selectedNames.has(depName)) excludedDependencies.push({ pkg, depName });
      }
    }
    for (const { pkg, depName } of excludedDependencies) {
      const dep = workspace.find(candidate => candidate.name === depName);
      if (!dep) continue;
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
    if (companions.length > 0) {
      log(`  After every wave: ${companions.map(pkg => pkg.name).join(', ')}`, 'blue');
    }

    // Step 4: preflight every repository before touching any of them
    logStep('4', 'Running preflight checks...');
    const blocking = [];
    for (const pkg of selected) {
      const { errors, warnings, pending } = preflightPackage(pkg, options, { fixable: true });
      const { published, error } = isVersionPublished(pkg, options);
      if (error) {
        logWarning(`${pkg.name}: could not reach the registry (${error.split('\n')[0]})`);
      }
      pkg.alreadyPublished = published;

      if (published) {
        // Nothing to publish for this one; its git state no longer blocks the run.
        logInfo(`${pkg.name}@${pkg.version} is already on npm — will skip the tag`);
        continue;
      }
      for (const warning of warnings) logWarning(`${pkg.name}: ${warning}`);
      for (const note of pending) logDetail(`${pkg.name}: ${note} — --commit will handle it`);
      for (const problem of errors) {
        logError(`${pkg.name}: ${problem}`);
        blocking.push(`${pkg.name}: ${problem}`);
      }
      if (errors.length === 0 && pending.length === 0) {
        logSuccess(`${pkg.name}@${pkg.version} ready to tag ${pkg.tag} at ${pkg.headSha.slice(0, 8)}`);
      }
    }

    for (const warning of checkDependencyRanges([...selected, ...companions])) {
      logWarning(warning);
    }

    // Under --commit every repository has to be on a branch that the release is
    // allowed to push to; a detached HEAD fails much later otherwise.
    if (options.commit) {
      for (const pkg of [...selected, ...companions]) {
        const branch = currentBranch(pkg.dir);
        if (!branch) {
          blocking.push(`${pkg.name}: detached HEAD — check out a branch before using --commit`);
          logError(`${pkg.name}: detached HEAD — check out a branch before using --commit`);
        } else if (pkg.remoteRef && pkg.remoteRef !== `origin/${branch}`) {
          logWarning(`${pkg.name}: on branch ${branch}, but ${pkg.remoteRef} is the release branch`);
        }
      }
    }

    if (blocking.length > 0) {
      log('');
      logError(`${blocking.length} preflight problem(s) — nothing was changed`);
      process.exitCode = 1;
      return;
    }

    // "Nothing to do" has to account for more than unpublished packages: a run
    // that died after the last publish still owes the release commits, the
    // companion pushes and the submodule-pointer sync.
    const pending = selected.filter(pkg => !pkg.alreadyPublished);
    const uncommitted = options.commit
      ? [...selected, ...companions].filter(pkg => (releaseDirtyEntries(pkg.dir) || []).length > 0)
      : [];
    const pointerWork = options.commit && options.submoduleSync && rootPkg
      ? submodulePointerEntries(rootPkg)
      : [];

    if (pending.length === 0 && uncommitted.length === 0 && pointerWork.length === 0) {
      log('');
      logSuccess('Every selected package is already published — nothing to do');
      return;
    }
    if (pending.length === 0) {
      logInfo('Every package is published; finishing the commits this release still owes');
    }

    if (options.watch && !commandExists('gh')) {
      logWarning('gh CLI not found — falling back to registry polling only');
      options.watch = false;
    }

    // Step 5: confirm
    logStep('5', 'Release plan');
    waves.forEach((wave, index) => {
      const todo = wave.filter(pkg => !pkg.alreadyPublished || options.commit);
      if (todo.length === 0) return;
      log(`  Wave ${index + 1}`, 'bright');
      for (const pkg of todo) {
        const steps = [];
        if (options.commit) steps.push('commit', options.pushCommit ? 'push' : 'commit only');
        if (!pkg.alreadyPublished) steps.push(`tag ${pkg.tag}`, 'wait for npm');
        else steps.push('already published');
        logDetail(`${pkg.name}: ${steps.join(' → ')}`);
      }
    });
    if (options.commit && companions.length > 0) {
      log('  Once every wave is live', 'bright');
      for (const pkg of companions) logDetail(`${pkg.name}: commit → push (never tagged)`);
    }
    if (options.commit && options.submoduleSync && rootPkg) {
      log('  Finally', 'bright');
      logDetail('root: commit the submodule pointers this release moved → push');
    }

    if (!options.yes && !options.dryRun) {
      const answer = await question('\nRun this release? (yes/no): ');
      if (!['y', 'yes'].includes(answer.trim().toLowerCase())) {
        logWarning('Aborted — nothing was changed');
        return;
      }
    }

    // Step 6: wave by wave — commit, push, tag, wait
    const published = [];
    const skipped = [];

    for (let index = 0; index < waves.length; index++) {
      const wave = waves[index];
      const todo = wave.filter(pkg => !pkg.alreadyPublished);
      wave.filter(pkg => pkg.alreadyPublished).forEach(pkg => skipped.push(pkg));

      const needsCommit = options.commit ? wave : [];
      if (todo.length === 0 && needsCommit.length === 0) continue;

      log(`\n${'─'.repeat(60)}`, 'cyan');
      log(`Wave ${index + 1}/${waves.length}: ${wave.map(pkg => pkg.name).join(', ')}`, 'bright');
      log('─'.repeat(60), 'cyan');

      // Commit and push first: this is the point where the repository's CI run
      // starts, and by now every package it depends on is already on npm.
      if (options.commit) {
        for (const pkg of wave) {
          commitAndPush(pkg, options);
        }

        // Re-run the checks against the commit that was just made. A dry run
        // has nothing to re-check — it never committed anything — and would
        // just report the problems the commit was going to fix.
        if (!options.dryRun) {
          const waveBlocking = [];
          for (const pkg of todo) {
            const { errors, warnings } = preflightPackage(pkg, options);
            for (const warning of warnings) logWarning(`${pkg.name}: ${warning}`);
            for (const problem of errors) {
              logError(`${pkg.name}: ${problem}`);
              waveBlocking.push(problem);
            }
          }
          if (waveBlocking.length > 0) {
            log('');
            logError('Stopping before tagging this wave — the release commits are already pushed.');
            process.exitCode = 1;
            return;
          }
        }
      }

      if (todo.length === 0) continue;

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

      // `npm view` answering is not quite the same as every CDN edge serving the
      // tarball, and the next wave installs it the moment it is pushed.
      const moreToDo = index < waves.length - 1 || companions.length > 0;
      if (options.settleSeconds > 0 && moreToDo) {
        logDetail(`letting the registry settle for ${options.settleSeconds}s`);
        await sleep(options.settleSeconds * 1000);
      }
    }

    // Step 7: the repositories that carry the version but publish nothing
    if (options.commit && companions.length > 0) {
      log(`\n${'─'.repeat(60)}`, 'cyan');
      log(`Repositories that publish nothing: ${companions.map(pkg => pkg.name).join(', ')}`, 'bright');
      log('─'.repeat(60), 'cyan');
      for (const pkg of companions) {
        commitAndPush(pkg, options);
      }
    }

    // Step 8: record the submodule commits in the root repository
    if (options.commit && options.submoduleSync && rootPkg) {
      log(`\n${'─'.repeat(60)}`, 'cyan');
      log('Syncing submodule pointers in the root repository', 'bright');
      log('─'.repeat(60), 'cyan');
      syncSubmodulePointers(rootPkg, options, rootPkg.version);
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
      console.log('  1. Draft the GitHub releases for the new tags');
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
