import type { BaseLogger } from 'vintasend/dist/services/loggers/base-logger';

import * as winston from 'winston';

export class WinstonLogger implements BaseLogger {
  private logger: winston.Logger;

  constructor(winstonOptions?: Parameters<typeof winston.createLogger>[0]) {
    this.logger = winston.createLogger(winstonOptions || {});

    if (process.env.NODE_ENV === 'development') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple(),
      }));
    }
  }

  info(message: string): void {
    this.logger.info(message);
  }

  error(message: string): void {
    this.logger.error(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }
}
