import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { build } from 'esbuild';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ENTRY = fileURLToPath(new URL('../index.ts', import.meta.url));
const NODE_BUILTINS = new Set(builtinModules);

function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith('node:') || NODE_BUILTINS.has(specifier.split('/')[0]);
}

describe('the vintasend entry in a browser', () => {
  it('bundles for the browser and loads with no Node globals', async () => {
    const result = await build({
      stdin: { contents: "export { log } from 'vintasend';", resolveDir: ROOT, loader: 'ts' },
      alias: { vintasend: ENTRY },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      globalName: 'bundle',
      write: false,
      logLevel: 'silent',
    });

    // A bare context has the language built-ins only: no process, Buffer, require or module.
    const context = vm.createContext({});
    vm.runInContext(result.outputFiles[0].text, context);

    expect(typeof context.bundle.log).toBe('function');
  });

  it('loads every export of the entry with no Node globals', async () => {
    const result = await build({
      stdin: { contents: "export * from 'vintasend';", resolveDir: ROOT, loader: 'ts' },
      alias: { vintasend: ENTRY },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      globalName: 'bundle',
      write: false,
      logLevel: 'silent',
    });

    const context = vm.createContext({});
    vm.runInContext(result.outputFiles[0].text, context);

    expect(typeof context.bundle.VintaSendFactory).toBe('function');
    expect(typeof context.bundle.BaseAttachmentManager).toBe('function');
  });

  it('imports no Node built-in anywhere in its module graph', async () => {
    // Bundled for Node, built-ins stay external, so the metafile lists every import of one,
    // static or dynamic, from the entry's own modules and from its dependencies.
    const result = await build({
      entryPoints: [ENTRY],
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
      metafile: true,
      logLevel: 'silent',
    });

    const builtinImports = Object.entries(result.metafile.inputs).flatMap(([file, input]) =>
      input.imports
        .filter((imported) => isNodeBuiltin(imported.path))
        .map((imported) => `${file} -> ${imported.path}`),
    );

    expect(builtinImports).toEqual([]);
  });

  it('serves LocalFileAttachmentManager from its own subpath, not from the entry', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const entry = await import('../index.js');
    const subpath = await import('../local-file-attachment-manager.js');

    expect(pkg.sideEffects).toBe(false);
    expect(pkg.exports['./local-file-attachment-manager']).toEqual({
      types: './dist/local-file-attachment-manager.d.ts',
      import: './dist/local-file-attachment-manager.js',
    });
    expect('LocalFileAttachmentManager' in entry).toBe(false);
    expect(typeof subpath.LocalFileAttachmentManager).toBe('function');
  });
});
