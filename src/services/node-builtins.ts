import type * as NodeCrypto from 'node:crypto';
import type * as NodeFsPromises from 'node:fs/promises';

type NodeBuiltins = {
  'node:crypto': typeof NodeCrypto;
  'node:fs/promises': typeof NodeFsPromises;
};

type ProcessWithBuiltins = {
  getBuiltinModule?: (id: string) => unknown;
};

/**
 * A Node built-in, fetched when a method needs it rather than imported when its module loads.
 *
 * `process.getBuiltinModule` is a function call, not an import: a module that uses this loads in a
 * browser, and a bundler targeting one has nothing to resolve. A method that needs the built-in
 * fails when it runs where there is none, never before.
 *
 * @throws Error when the runtime has no `process.getBuiltinModule` (a browser, or Node before 20.16).
 */
export function nodeBuiltin<Name extends keyof NodeBuiltins>(name: Name): NodeBuiltins[Name] {
  const runtimeProcess = (globalThis as { process?: ProcessWithBuiltins }).process;
  if (typeof runtimeProcess?.getBuiltinModule !== 'function') {
    throw new Error(
      `${name} is not available here: it needs Node.js 20.16 or later, or a runtime with process.getBuiltinModule.`,
    );
  }
  return runtimeProcess.getBuiltinModule(name) as NodeBuiltins[Name];
}
