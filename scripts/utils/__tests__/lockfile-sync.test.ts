/**
 * `lockfileDrift`: what the release script checks in a committed package-lock.json before and
 * after regenerating it. A publish workflow's `npm ci` refuses a lockfile that still pins a
 * workspace package at the previous release, which is how 1.0.0-alpha16 failed in ten repos.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// @ts-expect-error -- plain JS module without type declarations
import { isNotYetPublishedError, lockfileDrift, readLockfileDrift } from '../lockfile-sync.js';

const REGISTRY = 'https://registry.npmjs.org/';
const release = {
  version: '1.0.0-alpha16',
  internalNames: new Set(['vintasend', 'vintasend-managed-templates', 'vintasend-twilio']),
  registry: REGISTRY,
};

function published(name: string, version: string) {
  return {
    version,
    resolved: `${REGISTRY}${name}/-/${name}-${version}.tgz`,
    integrity: 'sha512-x',
  };
}

function lockfile(packages: Record<string, unknown>) {
  return { name: 'vintasend-twilio', lockfileVersion: 3, packages };
}

const inSync = lockfile({
  '': { name: 'vintasend-twilio', version: '1.0.0-alpha16' },
  'node_modules/vintasend': published('vintasend', '1.0.0-alpha16'),
  'node_modules/twilio': published('twilio', '5.0.0'),
});

describe('lockfileDrift', () => {
  it('finds nothing in a lockfile that matches the release', () => {
    expect(lockfileDrift(inSync, release)).toEqual([]);
  });

  it('reports a workspace dependency still locked at the previous release', () => {
    const stale = lockfile({
      '': { name: 'vintasend-twilio', version: '1.0.0-alpha16' },
      'node_modules/vintasend': published('vintasend', '1.0.0-alpha15'),
    });

    expect(lockfileDrift(stale, release)).toEqual([
      'node_modules/vintasend is locked at 1.0.0-alpha15, not 1.0.0-alpha16',
    ]);
  });

  it("reports the lockfile's own version left behind the bump", () => {
    const stale = lockfile({
      '': { name: 'vintasend-twilio', version: '1.0.0-alpha15' },
      'node_modules/vintasend': published('vintasend', '1.0.0-alpha16'),
    });

    expect(lockfileDrift(stale, release)).toEqual(['its own version is 1.0.0-alpha15, not 1.0.0-alpha16']);
  });

  it('checks nested copies of workspace packages too', () => {
    const stale = lockfile({
      '': { version: '1.0.0-alpha16' },
      'node_modules/vintasend': published('vintasend', '1.0.0-alpha16'),
      'node_modules/vintasend-managed-templates': published('vintasend-managed-templates', '1.0.0-alpha16'),
      'node_modules/vintasend-managed-templates/node_modules/vintasend': published('vintasend', '1.0.0-alpha15'),
    });

    expect(lockfileDrift(stale, release)).toEqual([
      'node_modules/vintasend-managed-templates/node_modules/vintasend is locked at 1.0.0-alpha15, not 1.0.0-alpha16',
    ]);
  });

  it('reports a workspace package linked from disk instead of installed from the registry', () => {
    const linked = lockfile({
      '': { version: '1.0.0-alpha16' },
      'node_modules/vintasend': { resolved: '../../..', link: true },
    });

    expect(lockfileDrift(linked, release)).toEqual([
      'node_modules/vintasend is a link to ../../.., not the published package',
    ]);
  });

  it('reports a workspace package resolved from somewhere other than the registry', () => {
    const elsewhere = lockfile({
      '': { version: '1.0.0-alpha16' },
      'node_modules/vintasend': { version: '1.0.0-alpha16', resolved: 'file:../../../vintasend-1.0.0-alpha16.tgz' },
    });

    expect(lockfileDrift(elsewhere, release)).toEqual([
      'node_modules/vintasend resolves from file:../../../vintasend-1.0.0-alpha16.tgz, not the registry',
    ]);
  });

  it('ignores third-party packages at any version', () => {
    const thirdParty = lockfile({
      '': { version: '1.0.0-alpha16' },
      'node_modules/twilio': published('twilio', '1.0.0'),
      'node_modules/not-vintasend': published('not-vintasend', '0.1.0'),
    });

    expect(lockfileDrift(thirdParty, release)).toEqual([]);
  });

  it('refuses a lockfile without a packages map, which npm ci cannot check either', () => {
    expect(lockfileDrift({ lockfileVersion: 1, dependencies: {} }, release)).toEqual([
      'package-lock.json has no "packages" map (lockfileVersion 2 or later is required)',
    ]);
  });
});

describe('readLockfileDrift', () => {
  const dirs: string[] = [];
  const tempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lockfile-sync-'));
    dirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is null for a package without a lockfile', () => {
    expect(readLockfileDrift(tempDir(), release)).toBeNull();
  });

  it('reads the lockfile on disk', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(inSync));

    expect(readLockfileDrift(dir, release)).toEqual([]);
  });

  it('reports a lockfile that is not JSON', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{');

    expect(readLockfileDrift(dir, release)?.[0]).toMatch(/^package-lock.json is not valid JSON/);
  });
});

describe('isNotYetPublishedError', () => {
  it('recognises npm failing on a version the registry does not serve yet', () => {
    expect(isNotYetPublishedError('npm error code ETARGET\nnpm error notarget No matching version found for vintasend@1.0.0-alpha16.')).toBe(true);
    expect(isNotYetPublishedError("npm error code E404\nnpm error 404 'vintasend-pug@1.0.0-alpha16' is not in this registry.")).toBe(true);
  });

  it('does not retry other failures', () => {
    expect(isNotYetPublishedError('npm error code ERESOLVE\nnpm error ERESOLVE unable to resolve dependency tree')).toBe(false);
    expect(isNotYetPublishedError('npm error code EACCES')).toBe(false);
  });
});
