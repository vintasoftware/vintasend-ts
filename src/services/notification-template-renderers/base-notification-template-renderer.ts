import type { JsonObject } from '../../types/json-values.js';
import type { AnyNotification } from '../../types/notification.js';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';
import type { BaseLogger } from '../loggers/base-logger.js';

/**
 * What every renderer's output carries in common, beyond the payload the adapter sends.
 *
 * Today that is one field: which version of the template actually rendered. `EmailTemplate` and
 * `TextNotificationTemplate` both extend this, so a renderer reports the version by setting it on
 * the object it already returns, and an adapter passes that object back from `send()` for the
 * service to record.
 */
export type NotificationSendInput = {
  /**
   * Which version of the template this render used, reported back so the service can record it on
   * the notification.
   *
   * Absent or `null` from every renderer that does not version templates, which is all of them
   * except the store-backed ones — a file on disk has no version to report.
   */
  templateVersion?: number | null;
};

export abstract class BaseNotificationTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
  T = unknown,
> {
  logger: BaseLogger | null = null;

  render(_notification: AnyNotification<Config>, _context: JsonObject): Promise<T> {
    throw 'Not implemented';
  }

  renderFromTemplateContent(
    _notification: AnyNotification<Config>,
    _templateContent: unknown,
    _context: JsonObject,
  ): Promise<T> {
    throw 'Not implemented';
  }

  /**
   * The newest version of a template, for a renderer whose templates are versioned.
   *
   * Concrete and returning `null` on purpose: templates in a file tree have no version to report,
   * and that is most renderers. A renderer reading from a store that versions them —
   * `vintasend-managed-templates` and anything like it — overrides this.
   *
   * `VintaSend` calls it to pin a notification to the version that is current the moment it is
   * created, so a later edit to the template cannot change what an already-recorded notification
   * renders. `null` simply means there is nothing to pin, and the notification keeps resolving its
   * template the way it always has.
   *
   * Best-effort by contract: throw if you like — the service logs it and carries on without a pin
   * rather than failing the write — but returning `null` for a template that does not exist is
   * kinder than throwing, since a missing template is the send's problem to report, not the
   * creation's.
   *
   * Declared optional so a renderer that spells its conformance `implements
   * BaseEmailTemplateRenderer` — rather than extending it — does not have to grow a method it has
   * no use for. Subclasses that `extend` inherit this implementation and need do nothing either.
   *
   * @param _templateKey what the notification's `bodyTemplate` names.
   * @returns the newest version number, or `null` if this renderer does not version templates (or
   *   cannot find that one).
   */
  getLatestTemplateVersion?(_templateKey: string): Promise<number | null> {
    return Promise.resolve(null);
  }

  injectLogger(logger: BaseLogger): void {
    this.logger = logger;
  }
}
