/**
 * Typed log messages.
 *
 * A log line is built with the `log` tagged template. The fixed text of the template comes from
 * source code, and every interpolated value must be a `LogValue` produced by one of the helpers
 * below, each of which says what kind of value it is. Raw strings, objects and errors do not
 * type-check as interpolations, so notification content, rendered bodies, context objects and
 * error messages cannot reach a logger by accident.
 *
 * Loggers receive the template and the tagged values, so a host can render them as-is
 * (`renderLogMessage`), hash ids, drop labels, or ship them as structured fields.
 *
 * The helpers are the review surface: `logId` and `logLabel` accept strings, so what is passed to
 * them is the one thing a reviewer has to check.
 */

const LOG_VALUE: unique symbol = Symbol('vintasend.logValue');

type Branded<T> = T & { readonly [LOG_VALUE]: true };

export type LogValue =
  /** A record id or reference string, e.g. a notification id or `Media/123`. */
  | Branded<{ readonly kind: 'id'; readonly value: string }>
  /** Several record ids or reference strings. */
  | Branded<{ readonly kind: 'ids'; readonly value: readonly string[] }>
  | Branded<{ readonly kind: 'count'; readonly value: number }>
  /** A code-defined name: adapter key, backend identifier, operation, template path. */
  | Branded<{ readonly kind: 'label'; readonly value: string }>
  | Branded<{ readonly kind: 'timestamp'; readonly value: string }>
  /** An error reduced to its name and, when known, its HTTP status. */
  | Branded<{ readonly kind: 'error'; readonly name: string; readonly status?: number }>;

export type LogValueKind = LogValue['kind'];

type IdLike = string | number | bigint | null | undefined;

function brand<T extends object>(value: T): Branded<T> {
  return Object.freeze({ ...value, [LOG_VALUE]: true as const });
}

export function logId(value: IdLike): LogValue {
  return brand({ kind: 'id', value: String(value) });
}

export function logIds(values: readonly IdLike[]): LogValue {
  return brand({ kind: 'ids', value: Object.freeze(values.map((value) => String(value))) });
}

export function logCount(value: number): LogValue {
  return brand({ kind: 'count', value });
}

/**
 * A name defined in code, never one derived from user or patient data.
 */
export function logLabel(value: string | null | undefined): LogValue {
  return brand({ kind: 'label', value: String(value) });
}

export function logTimestamp(value: Date | string | null | undefined): LogValue {
  if (value instanceof Date) {
    return brand({
      kind: 'timestamp',
      value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString(),
    });
  }
  return brand({ kind: 'timestamp', value: String(value) });
}

/**
 * Reduce an error to its name and HTTP status. The message, stack and any attached payload are
 * dropped: messages from data stores and providers can quote the request that failed.
 *
 * The status is taken from `options.status`, or from a numeric `status` / `statusCode` on the
 * error. Pass `options.status` when the error type needs a package-specific lookup.
 */
export function logError(error: unknown, options: { status?: number } = {}): LogValue {
  const name =
    error instanceof Error
      ? error.name || 'Error'
      : `non-Error ${error === null ? 'null' : typeof error}`;
  const status = options.status ?? readNumericStatus(error);
  return brand(status === undefined ? { kind: 'error', name } : { kind: 'error', name, status });
}

function readNumericStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  if (typeof status === 'number') return status;
  if (typeof statusCode === 'number') return statusCode;
  return undefined;
}

export function isLogValue(value: unknown): value is LogValue {
  return typeof value === 'object' && value !== null && LOG_VALUE in value;
}

export class LogMessage {
  /** A non-public member makes the type nominal, so only `log` can create one. */
  protected readonly brand = 'vintasend.LogMessage' as const;

  private constructor(
    readonly strings: readonly string[],
    readonly values: readonly LogValue[],
  ) {}

  /** @internal Use the `log` tagged template. */
  static fromTemplate(strings: TemplateStringsArray, values: readonly LogValue[]): LogMessage {
    return new LogMessage(Object.freeze([...strings]), Object.freeze([...values]));
  }

  /** Renders with `renderLogMessage` defaults, so `String(message)` is always safe to print. */
  toString(): string {
    return renderLogMessage(this);
  }
}

export function log(strings: TemplateStringsArray, ...values: LogValue[]): LogMessage {
  for (const value of values) {
    if (!isLogValue(value)) {
      // A cast got an untagged value past the type checker. Fail loudly in development instead of
      // printing it.
      throw new TypeError(
        'log`...` interpolations must be built with logId, logIds, logCount, logLabel, logTimestamp or logError',
      );
    }
  }
  return LogMessage.fromTemplate(strings, values);
}

export function isLogMessage(value: unknown): value is LogMessage {
  return value instanceof LogMessage;
}

export function renderLogValue(value: LogValue): string {
  switch (value.kind) {
    case 'id':
    case 'label':
    case 'timestamp':
      return value.value;
    case 'ids':
      return value.value.join(', ');
    case 'count':
      return String(value.value);
    case 'error':
      return value.status === undefined ? value.name : `${value.name} (status ${value.status})`;
  }
}

type AsymmetricMatcherLike = { asymmetricMatch(actual: unknown): boolean };

/**
 * Asymmetric matcher for Vitest/Jest: matches a `LogMessage` whose rendered text equals `expected`
 * or satisfies another asymmetric matcher, e.g.
 * `expect(logger.error).toHaveBeenCalledWith(logMessageMatching(expect.stringContaining('123')))`.
 */
export function logMessageMatching(expected: string | AsymmetricMatcherLike) {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (!isLogMessage(actual)) return false;
      const rendered = renderLogMessage(actual);
      return typeof expected === 'string'
        ? rendered === expected
        : expected.asymmetricMatch(rendered);
    },
    toString: () => 'LogMessage',
    toAsymmetricMatcher: () =>
      `LogMessage(${typeof expected === 'string' ? JSON.stringify(expected) : String(expected)})`,
  };
}

export type RenderLogMessageOptions = {
  /** Override how a value is printed, e.g. to hash ids. Falls back to `renderLogValue`. */
  renderValue?: (value: LogValue) => string;
};

export function renderLogMessage(
  message: LogMessage,
  options: RenderLogMessageOptions = {},
): string {
  const renderValue = options.renderValue ?? renderLogValue;
  let rendered = message.strings[0] ?? '';
  message.values.forEach((value, index) => {
    rendered += renderValue(value) + (message.strings[index + 1] ?? '');
  });
  return rendered;
}
