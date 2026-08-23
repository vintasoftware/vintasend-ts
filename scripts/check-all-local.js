#!/usr/bin/env node

/**
 * Run the full check suite across every package in this workspace, wired to
 * local sources instead of published ones.
 *
 * Every dependency that points at another package in this repository is
 * temporarily rewritten to a `file:` spec, so an implementation is checked
 * against the `vintasend` sitting next to it rather than whatever the registry
 * currently serves. Packages are visited in dependency order and built before
 * their dependents, because `tsc` resolves types out of each dependency's
 * `dist/`.
 *
 * The rewritten package.json files are always restored — on success, on
 * failure, and on Ctrl-C.
 *
 * Unlike `test-implementations-local.js`, which runs one script against one
 * dependency, this covers the whole graph (including implementation-to-
 * implementation dependencies) and keeps going after a failure so one run
 * reports every problem.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootDir = path.join(__dirname, '..');
const implementationsDir = path.join(rootDir, 'src', 'implementations');
const toolsDir = path.join(rootDir, 'src', 'tools');

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies'];
const TEMPLATE_DIR_NAME = 'vintasend-implementation-template';
const DEFAULT_CHECKS = ['build', 'lint', 'format', 'typecheck', 'test'];

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
Usage: node scripts/check-all-local.js [options]

Points every package at its local dependencies, then runs build, lint, format,
typecheck and test across all of them in dependency order.

Options:
  --only=a,b          Only check these packages (by npm name or directory name)
  --skip=a,b          Skip these packages (by npm name or directory name)
  --checks=a,b        Checks to run, in order (default: ${DEFAULT_CHECKS.join(',')})
  --fix               Let format rewrite files instead of only reporting
  --bail              Stop at the first failing package
  --no-install        Don't run npm install (assumes node_modules are linked already)
  --include-template  Also check ${TEMPLATE_DIR_NAME}
  --keep-links        Leave the file: dependency specs in place when finished
  --verbose           Stream command output instead of showing it only on failure
  --help, -h          Show this message
`.trim();

function parseArgs(argv) {
  const options = {
    only: new Set(),
    skip: new Set(),
    checks: [...DEFAULT_CHECKS],
    fix: false,
    bail: false,
    install: true,
    includeTemplate: false,
    keepLinks: false,
    verbose: false,
    help: false
  };

  const collectList = value =>
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

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
    if (arg === '--fix') {
      options.fix = true;
      continue;
    }
    if (arg === '--bail') {
      options.bail = true;
      continue;
    }
    if (arg === '--no-install') {
      options.install = false;
      continue;
    }
    if (arg === '--include-template') {
      options.includeTemplate = true;
      continue;
    }
    if (arg === '--keep-links') {
      options.keepLinks = true;
      continue;
    }
    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    const only = takeValue('--only');
    if (only !== null) {
      collectList(only).forEach(item => options.only.add(item));
      continue;
    }

    const skip = takeValue('--skip');
    if (skip !== null) {
      collectList(skip).forEach(item => options.skip.add(item));
      continue;
    }

    const checks = takeValue('--checks');
    if (checks !== null) {
      options.checks = collectList(checks);
      continue;
    }

    logWarning(`Ignoring unknown option: ${arg}`);
  }

  const unknownChecks = options.checks.filter(check => !DEFAULT_CHECKS.includes(check));
  if (unknownChecks.length > 0) {
    throw new Error(
      `Unknown check(s): ${unknownChecks.join(', ')}. Available: ${DEFAULT_CHECKS.join(', ')}`
    );
  }

  return options;
}

// ---------------------------------------------------------------------------
// Package discovery and linking
// ---------------------------------------------------------------------------

function listSubdirectories(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(dir, dirent.name));
}

function readPackageJson(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function discoverPackages(options) {
  const candidates = [rootDir, ...listSubdirectories(implementationsDir), ...listSubdirectories(toolsDir)];
  const packages = [];

  for (const dir of candidates) {
    const dirName = path.basename(dir);
    if (dirName === TEMPLATE_DIR_NAME && !options.includeTemplate) continue;

    const packageJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;

    const packageJson = readPackageJson(packageJsonPath);
    if (!packageJson.name) continue;

    packages.push({
      name: packageJson.name,
      dirName,
      dir,
      isRoot: dir === rootDir,
      packageJsonPath,
      packageJson,
      scripts: packageJson.scripts || {},
      // The formatters are invoked directly when a package declares no script
      // of its own, so only offer one where the package actually depends on it.
      // Most packages use biome; the dashboards use prettier.
      hasBiome: Boolean(
        packageJson.devDependencies?.['@biomejs/biome'] ||
          packageJson.dependencies?.['@biomejs/biome']
      ),
      hasPrettier: Boolean(
        packageJson.devDependencies?.prettier || packageJson.dependencies?.prettier
      ),
      hasTypescript: Boolean(
        packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript
      )
    });
  }

  return packages;
}

/**
 * Record which local packages each package depends on, ignoring everything that
 * resolves from the registry.
 */
function buildDependencyGraph(packages) {
  const localNames = new Set(packages.map(pkg => pkg.name));

  for (const pkg of packages) {
    const dependencies = new Set();

    for (const field of DEPENDENCY_FIELDS) {
      const declared = pkg.packageJson[field];
      if (!declared) continue;
      for (const depName of Object.keys(declared)) {
        if (depName !== pkg.name && localNames.has(depName)) dependencies.add(depName);
      }
    }

    pkg.dependencies = dependencies;
  }

  return packages;
}

/**
 * Order packages so every dependency is built before its dependents. Cycles are
 * reported rather than thrown: the remaining packages still get checked, they
 * just can't be guaranteed a freshly built dependency.
 */
function topologicalOrder(packages) {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const selected = new Set(byName.keys());
  const remaining = new Set(selected);
  const ordered = [];

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter(name => ![...byName.get(name).dependencies].some(dep => remaining.has(dep)))
      .sort();

    if (ready.length === 0) {
      logWarning(`Dependency cycle among: ${[...remaining].sort().join(', ')} — checking in name order`);
      ordered.push(...[...remaining].sort().map(name => byName.get(name)));
      break;
    }

    for (const name of ready) {
      ordered.push(byName.get(name));
      remaining.delete(name);
    }
  }

  return ordered;
}

/**
 * Rewrite every local dependency to a `file:` spec pointing at its directory.
 * Returns the original file contents so they can be restored byte for byte.
 */
function linkLocalDependencies(packages) {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const originals = new Map();
  const rewrites = [];

  for (const pkg of packages) {
    const original = fs.readFileSync(pkg.packageJsonPath, 'utf8');
    const packageJson = JSON.parse(original);
    let changed = false;

    for (const field of DEPENDENCY_FIELDS) {
      const declared = packageJson[field];
      if (!declared) continue;

      for (const depName of Object.keys(declared)) {
        const dep = byName.get(depName);
        if (!dep || depName === pkg.name) continue;

        const spec = `file:${toPosix(path.relative(pkg.dir, dep.dir)) || '.'}`;
        if (declared[depName] === spec) continue;

        rewrites.push(`${pkg.name}: ${field}.${depName} ${declared[depName]} → ${spec}`);
        declared[depName] = spec;
        changed = true;
      }
    }

    // Always record the original, even when unchanged: restoration then works
    // the same way no matter which packages were touched.
    originals.set(pkg.packageJsonPath, original);
    if (changed) {
      fs.writeFileSync(pkg.packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    }
  }

  return { originals, rewrites };
}

function restorePackageJsons(originals) {
  for (const [packageJsonPath, original] of originals) {
    try {
      fs.writeFileSync(packageJsonPath, original, 'utf8');
    } catch (error) {
      logError(`Could not restore ${packageJsonPath}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Pick the command for a check in a given package.
 *
 * A package's own npm script always wins; the fallbacks exist so a package that
 * never declared, say, a `typecheck` script still gets type-checked. `null`
 * means there is nothing sensible to run, and the check is reported as skipped.
 */
function resolveCheck(check, pkg, options) {
  const npmScript = name => ({ command: 'npm', args: ['run', name] });

  switch (check) {
    case 'build':
      return pkg.scripts.build ? npmScript('build') : null;

    case 'lint':
      if (pkg.scripts.lint) return npmScript('lint');
      return pkg.hasBiome ? { command: 'npx', args: ['biome', 'check', '.'] } : null;

    case 'format':
      // `npm run format` rewrites files everywhere in this repo (`biome check
      // --write`, or `prettier --write` in the dashboards), so it only runs
      // under --fix. Report-only mode needs a separate command, which is why
      // `scripts.format` is deliberately not consulted below.
      if (options.fix) {
        if (pkg.scripts.format) return npmScript('format');
        if (pkg.hasBiome) return { command: 'npx', args: ['biome', 'check', '--write', '.'] };
        if (pkg.hasPrettier) return { command: 'npx', args: ['prettier', '--write', '.'] };
        return null;
      }
      if (pkg.scripts['format:check']) return npmScript('format:check');
      if (pkg.hasBiome) return { command: 'npx', args: ['biome', 'format', '.'] };
      if (pkg.hasPrettier) return { command: 'npx', args: ['prettier', '--check', '.'] };
      return null;

    case 'typecheck':
      if (pkg.scripts.typecheck) return npmScript('typecheck');
      return pkg.hasTypescript ? { command: 'npx', args: ['tsc', '--noEmit'] } : null;

    case 'test':
      return pkg.scripts.test ? npmScript('test') : null;

    default:
      return null;
  }
}

function runCommand({ command, args }, cwd, options) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: options.verbose ? 'inherit' : 'pipe'
  });

  const output = options.verbose
    ? ''
    : `${result.stdout || ''}${result.stderr || ''}`.trim();

  return {
    success: result.status === 0,
    status: result.status,
    output: result.error ? `${output}\n${result.error.message}`.trim() : output,
    durationMs: Date.now() - started
  };
}

function formatDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function checkPackage(pkg, options) {
  const results = [];

  if (options.install) {
    const install = runCommand(
      { command: 'npm', args: ['install', '--no-package-lock'] },
      pkg.dir,
      options
    );
    if (!install.success) {
      logError(`  install failed (${formatDuration(install.durationMs)})`);
      if (install.output) console.log(install.output);
      results.push({ check: 'install', status: 'failed', output: install.output });
      return results;
    }
    logDetail(`install ok (${formatDuration(install.durationMs)})`);
    results.push({ check: 'install', status: 'passed' });
  }

  for (const check of options.checks) {
    const command = resolveCheck(check, pkg, options);

    if (!command) {
      logDetail(`${check} skipped (nothing to run)`);
      results.push({ check, status: 'skipped' });
      continue;
    }

    const result = runCommand(command, pkg.dir, options);
    const label = `${check} (${command.command} ${command.args.join(' ')})`;

    if (result.success) {
      logSuccess(`  ${label} — ${formatDuration(result.durationMs)}`);
      results.push({ check, status: 'passed' });
    } else {
      logError(`  ${label} — exit ${result.status} in ${formatDuration(result.durationMs)}`);
      if (result.output) console.log(result.output);
      results.push({ check, status: 'failed', output: result.output });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP);
    return;
  }

  log('\n========================================', 'bright');
  log('  VintaSend - Local Cross-Package Checks', 'bright');
  log('========================================\n', 'bright');

  // Step 1: discover
  logStep('1', 'Discovering packages...');
  const discovered = buildDependencyGraph(discoverPackages(options));
  if (discovered.length === 0) {
    logError('No packages found');
    process.exitCode = 1;
    return;
  }

  const matches = (pkg, names) =>
    names.has(pkg.name) || names.has(pkg.dirName) || (pkg.isRoot && (names.has('root') || names.has('main')));

  const knownNames = new Set(['root', 'main', ...discovered.flatMap(pkg => [pkg.name, pkg.dirName])]);
  for (const name of [...options.only, ...options.skip]) {
    if (!knownNames.has(name)) logWarning(`Unknown package name in filters: ${name}`);
  }

  let selected = discovered;
  if (options.only.size > 0) selected = selected.filter(pkg => matches(pkg, options.only));
  if (options.skip.size > 0) selected = selected.filter(pkg => !matches(pkg, options.skip));

  if (selected.length === 0) {
    logError('Every package was filtered out');
    process.exitCode = 1;
    return;
  }

  // Dependencies that were filtered out stay on their published versions; the
  // graph must only describe packages that are actually present in this run.
  const selectedNames = new Set(selected.map(pkg => pkg.name));
  for (const pkg of selected) {
    for (const depName of [...pkg.dependencies]) {
      if (!selectedNames.has(depName)) {
        pkg.dependencies.delete(depName);
        logWarning(`${pkg.name} depends on ${depName}, which is excluded — it will use its published version`);
      }
    }
  }

  logSuccess(`Checking ${selected.length} package(s)`);

  // Step 2: order
  logStep('2', 'Ordering packages by dependency...');
  const ordered = topologicalOrder(selected);
  ordered.forEach((pkg, index) => {
    const deps = [...pkg.dependencies];
    logDetail(`${index + 1}. ${pkg.name}${deps.length > 0 ? ` (after ${deps.join(', ')})` : ''}`);
  });

  // Step 3: link
  logStep('3', 'Pointing packages at their local dependencies...');
  const { originals, rewrites } = linkLocalDependencies(ordered);

  let restored = false;
  const restore = () => {
    if (restored || options.keepLinks) return;
    restored = true;
    restorePackageJsons(originals);
  };
  const onInterrupt = () => {
    log('');
    logWarning('Interrupted — restoring package.json files');
    restore();
    process.exit(130);
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onInterrupt);

  const summary = [];

  try {
    if (rewrites.length === 0) {
      logInfo('No dependency specs needed rewriting');
    } else {
      for (const rewrite of rewrites) logDetail(rewrite);
      logSuccess(`Rewrote ${rewrites.length} dependency spec(s) to file: links`);
    }

    // Step 4: check
    logStep('4', `Running checks: ${options.checks.join(', ')}`);
    if (!options.fix && options.checks.includes('format')) {
      logInfo('format runs in report-only mode — pass --fix to rewrite files');
    }

    for (let index = 0; index < ordered.length; index++) {
      const pkg = ordered[index];
      log(`\n${'─'.repeat(60)}`, 'cyan');
      log(`${index + 1}/${ordered.length}: ${pkg.name}`, 'bright');
      log('─'.repeat(60), 'cyan');

      const results = checkPackage(pkg, options);
      summary.push({ pkg, results });

      if (options.bail && results.some(result => result.status === 'failed')) {
        logWarning('Stopping after first failure (--bail)');
        break;
      }
    }
  } finally {
    restore();
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onInterrupt);
  }

  // Step 5: summary
  log(`\n${'='.repeat(60)}`, 'bright');
  log('  Summary', 'bright');
  log('='.repeat(60), 'bright');

  const columns = options.install ? ['install', ...options.checks] : [...options.checks];
  const nameWidth = Math.max(...summary.map(entry => entry.pkg.name.length), 7);
  const cellWidth = Math.max(...columns.map(column => column.length)) + 2;

  log(
    `${'package'.padEnd(nameWidth)}  ${columns.map(column => column.padEnd(cellWidth)).join('')}`,
    'gray'
  );

  const failures = [];
  for (const { pkg, results } of summary) {
    const byCheck = new Map(results.map(result => [result.check, result.status]));
    const cells = columns.map(column => {
      const status = byCheck.get(column);
      if (status === 'passed') return `${colors.green}pass${colors.reset}`.padEnd(cellWidth + 9);
      if (status === 'failed') return `${colors.red}FAIL${colors.reset}`.padEnd(cellWidth + 9);
      if (status === 'skipped') return `${colors.gray}—${colors.reset}`.padEnd(cellWidth + 9);
      return ''.padEnd(cellWidth);
    });
    console.log(`${pkg.name.padEnd(nameWidth)}  ${cells.join('')}`);

    for (const result of results) {
      if (result.status === 'failed') failures.push(`${pkg.name}: ${result.check}`);
    }
  }

  log('');
  if (options.keepLinks) {
    logWarning('--keep-links: package.json files still point at local file: specs');
  } else {
    logInfo('package.json files restored; run npm install in a package to unlink node_modules');
  }

  if (failures.length > 0) {
    logError(`${failures.length} check(s) failed:`);
    for (const failure of failures) logDetail(failure);
    process.exitCode = 1;
    return;
  }

  logSuccess('All checks passed');
}

main();
