import { describe, expect, it, vi } from 'vitest';
import type { BaseLogger } from '../base-logger';
import {
  isLogMessage,
  type LogValue,
  log,
  logCount,
  logError,
  logId,
  logIds,
  logLabel,
  logMessageMatching,
  logTimestamp,
  renderLogMessage,
} from '../log-message';

describe('log messages', () => {
  it('renders ids, counts, labels, timestamps and errors into the template', () => {
    const message = log`Sent ${logId(42)} via ${logLabel('email')}: ${logCount(3)} files, ${logIds(['a', 'b'])} at ${logTimestamp(new Date('2026-01-02T03:04:05.000Z'))}`;

    expect(renderLogMessage(message)).toBe(
      'Sent 42 via email: 3 files, a, b at 2026-01-02T03:04:05.000Z',
    );
    expect(String(message)).toBe(renderLogMessage(message));
  });

  it('reduces an error to its name, dropping the message', () => {
    const error = new TypeError('Patient Jane Synthetic, DOB 1970-01-01, not found');

    const rendered = renderLogMessage(log`failed: ${logError(error)}`);

    expect(rendered).toBe('failed: TypeError');
    expect(rendered).not.toContain('Jane Synthetic');
  });

  it('keeps an HTTP status from the error or from options', () => {
    const httpError = Object.assign(new Error('body echoed back'), { statusCode: 503 });

    expect(renderLogMessage(log`${logError(httpError)}`)).toBe('Error (status 503)');
    expect(renderLogMessage(log`${logError(new Error('x'), { status: 404 })}`)).toBe(
      'Error (status 404)',
    );
  });

  it('describes non-Error throwables by type only', () => {
    expect(renderLogMessage(log`${logError('Jane Synthetic')}`)).toBe('non-Error string');
    expect(renderLogMessage(log`${logError({ patient: 'Jane Synthetic' })}`)).toBe(
      'non-Error object',
    );
    expect(renderLogMessage(log`${logError(null)}`)).toBe('non-Error null');
  });

  it('lets a host override how values render', () => {
    const message = log`notification ${logId('abc')} via ${logLabel('sms')}`;

    const rendered = renderLogMessage(message, {
      renderValue: (value) => (value.kind === 'id' ? '<id>' : String(value.kind)),
    });

    expect(rendered).toBe('notification <id> via label');
  });

  it('throws when a cast gets an untagged value past the type checker', () => {
    const smuggled = 'Jane Synthetic' as unknown as LogValue;

    expect(() => log`hello ${smuggled}`).toThrow(TypeError);
  });

  it('rejects plain strings and raw interpolations at compile time', () => {
    const logger: BaseLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const patientName = 'Jane Synthetic';

    // @ts-expect-error a logger only accepts LogMessage, never a plain string
    expect(() => logger.info(`hello ${patientName}`)).not.toThrow();
    // @ts-expect-error interpolations must be LogValues built by the helpers
    expect(() => log`hello ${patientName}`).toThrow(TypeError);
    // @ts-expect-error LogValues cannot be built by hand
    const forged: LogValue = { kind: 'label', value: patientName };
    expect(forged).toBeDefined();
  });

  it('matches rendered text in assertions', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    logger.info(log`Notification ${logId(7)} created`);

    expect(isLogMessage(logger.info.mock.calls[0][0])).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(logMessageMatching('Notification 7 created'));
    expect(logger.info).toHaveBeenCalledWith(
      logMessageMatching(expect.stringContaining('Notification 7')),
    );
    expect(logger.info).not.toHaveBeenCalledWith(logMessageMatching('Notification 8 created'));
  });
});
