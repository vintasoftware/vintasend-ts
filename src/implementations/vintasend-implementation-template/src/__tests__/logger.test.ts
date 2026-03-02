import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize successfully with default console logger', () => {
    expect(logger).toBeDefined();
  });

  it('should log info messages', () => {
    const message = 'test info message';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info(message);

    expect(logSpy).toHaveBeenCalledWith(message);
  });

  it('should log error messages', () => {
    const message = 'test error message';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error(message);

    expect(errorSpy).toHaveBeenCalledWith(message);
  });

  it('should log warning messages', () => {
    const message = 'test warning message';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn(message);

    expect(warnSpy).toHaveBeenCalledWith(message);
  });
});
