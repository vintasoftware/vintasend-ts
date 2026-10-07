import type { LogMessage } from './log-message.js';

/**
 * Logger injected into VintaSend and every backend, adapter and renderer.
 *
 * Messages are `LogMessage`s built with the `log` tagged template, never plain strings, so a
 * logger only ever receives ids, counts, code-defined labels, timestamps and reduced errors.
 * Use `renderLogMessage` (or `String(message)`) to print one.
 */
export interface BaseLogger {
  info(message: LogMessage): void;
  error(message: LogMessage): void;
  warn(message: LogMessage): void;
}
