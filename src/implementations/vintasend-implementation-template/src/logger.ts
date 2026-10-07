import { type BaseLogger, type LogMessage, renderLogMessage } from 'vintasend';

/**
 * Forwards VintaSend's log lines to the console.
 *
 * Messages arrive as `LogMessage`s, built with the `log` tagged template: fixed text from source
 * code plus typed values (ids, counts, code-defined labels, timestamps, errors reduced to their
 * name and HTTP status). They never carry notification content, so print them with
 * `renderLogMessage` rather than serializing anything else alongside them.
 *
 * To hash ids or drop labels, pass `{ renderValue }` to `renderLogMessage`. To ship structured
 * fields instead of a line, read `message.strings` and `message.values`.
 */
export class Logger implements BaseLogger {
  private logger: Pick<Console, 'log' | 'error' | 'warn'>;

  constructor() {
    // biome-ignore lint/style/noRestrictedGlobals: a console-backed logger is the one place a package may reference console; everything else logs through the injected BaseLogger.
    this.logger = console;
  }

  info(message: LogMessage): void {
    this.logger.log(renderLogMessage(message));
  }

  error(message: LogMessage): void {
    this.logger.error(renderLogMessage(message));
  }

  warn(message: LogMessage): void {
    this.logger.warn(renderLogMessage(message));
  }
}
