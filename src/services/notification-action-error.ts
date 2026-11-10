/**
 * Why `VintaSend.requeueNotification` or `VintaSend.repinNotification` refused.
 *
 * * `NOT_FOUND`: no notification has that ID in the primary backend.
 * * `INVALID_STATUS`: the notification's status does not allow the action. `status` says which.
 * * `NO_TEMPLATE_VERSION`: a re-pin to the current version found none, because the renderer for
 *   the notification's type does not version templates, or failed to answer.
 */
export type NotificationActionErrorReason = 'NOT_FOUND' | 'INVALID_STATUS' | 'NO_TEMPLATE_VERSION';

export type NotificationAction = 'requeue' | 'repin';

/**
 * Thrown when a notification action is refused before anything is written.
 *
 * Callers branch on `reason`, not on the message. Code that may load a second copy of this
 * package, such as an HTTP API with its own `vintasend` dependency, should test
 * `isNotificationActionError` rather than `instanceof`, which fails across copies.
 *
 * The message names the notification by ID only, so it is safe to log.
 */
export class NotificationActionError extends Error {
  override readonly name = 'NotificationActionError';
  readonly action: NotificationAction;
  readonly reason: NotificationActionErrorReason;
  readonly notificationId: string;
  readonly status: string | undefined;

  constructor(params: {
    action: NotificationAction;
    reason: NotificationActionErrorReason;
    notificationId: unknown;
    message: string;
    status?: string;
  }) {
    super(params.message);
    this.action = params.action;
    this.reason = params.reason;
    this.notificationId = String(params.notificationId);
    this.status = params.status;
  }
}

const REASONS: readonly string[] = ['NOT_FOUND', 'INVALID_STATUS', 'NO_TEMPLATE_VERSION'];

/**
 * Whether `error` is a `NotificationActionError`, from this copy of the package or another one.
 */
export function isNotificationActionError(error: unknown): error is NotificationActionError {
  if (error instanceof NotificationActionError) {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { name?: unknown; reason?: unknown };
  return (
    candidate.name === 'NotificationActionError' &&
    typeof candidate.reason === 'string' &&
    REASONS.includes(candidate.reason)
  );
}
