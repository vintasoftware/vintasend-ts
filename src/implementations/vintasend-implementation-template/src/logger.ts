import type { BaseLogger } from 'vintasend/dist/services/loggers/base-logger';

export class Logger implements BaseLogger {
  private logger: typeof console;

  constructor() {
    this.logger = console;
  }

  info(message: string): void {
    this.logger.log(message);
  }

  error(message: string): void {
    this.logger.error(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }
}
