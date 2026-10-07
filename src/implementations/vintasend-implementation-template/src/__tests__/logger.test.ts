import { log, logCount, logError, logId, logLabel } from 'vintasend';
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
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info(log`Sent notification ${logId('notification-1')} via ${logLabel('adapter-key')}`);

    expect(logSpy).toHaveBeenCalledWith('Sent notification notification-1 via adapter-key');
  });

  it('should log error messages', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error(
      log`Failed to send notification ${logId('notification-1')}: ${logError(new TypeError('boom'))}`,
    );

    expect(errorSpy).toHaveBeenCalledWith('Failed to send notification notification-1: TypeError');
  });

  it('should log warning messages', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn(log`Skipped ${logCount(2)} notifications`);

    expect(warnSpy).toHaveBeenCalledWith('Skipped 2 notifications');
  });

  it('should print only the error name and status, never the message', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(
      new Error('Mailbox full for Jane Synthetic <jane.synthetic@example.com>'),
      { status: 452 },
    );

    logger.error(
      log`Provider rejected notification ${logId('notification-1')}: ${logError(error)}`,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Provider rejected notification notification-1: Error (status 452)',
    );
    const printed = errorSpy.mock.calls.flat().join('\n');
    expect(printed).not.toContain('Jane Synthetic');
    expect(printed).not.toContain('jane.synthetic@example.com');
  });
});
