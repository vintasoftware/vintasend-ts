import type { StoredAttachment } from '../../types/attachment';
import type { JsonObject, JsonValue } from '../../types/json-values';
import type { AnyDatabaseNotification, DatabaseOneOffNotification } from '../../types/notification';
import type { NotificationType } from '../../types/notification-type';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';
import type {
  EmailTemplate,
  EmailTemplateContent,
} from '../notification-template-renderers/base-email-template-renderer';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';
/**
 * Type guard to check if a notification is a one-off notification
 */
export declare function isOneOffNotification<Config extends BaseNotificationTypeConfig>(
  notification: AnyDatabaseNotification<Config>,
): notification is DatabaseOneOffNotification<Config>;
export declare abstract class BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> {
  protected templateRenderer: TemplateRenderer;
  readonly notificationType: NotificationType;
  readonly enqueueNotifications: boolean;
  key: string | null;
  backend: BaseNotificationBackend<Config> | null;
  logger: BaseLogger | null;
  constructor(
    templateRenderer: TemplateRenderer,
    notificationType: NotificationType,
    enqueueNotifications: boolean,
  );
  send(_notification: AnyDatabaseNotification<Config>, _context: JsonValue): Promise<void>;
  /**
   * Check if this adapter supports attachments
   */
  get supportsAttachments(): boolean;
  /**
   * Prepare attachments for sending
   * Override in adapters that support attachments
   */
  protected prepareAttachments(attachments: StoredAttachment[]): Promise<unknown>;
  /**
   * Get the recipient email address from a notification.
   * For one-off notifications, returns the emailOrPhone field directly.
   * For regular notifications, fetches the email from the user via backend.
   */
  protected getRecipientEmail(notification: AnyDatabaseNotification<Config>): Promise<string>;
  /**
   * Get the recipient name from a notification.
   * For one-off notifications, returns the firstName and lastName fields directly.
   * For regular notifications, attempts to extract from context or returns empty strings.
   */
  protected getRecipientName(
    notification: AnyDatabaseNotification<Config>,
    context: JsonValue,
  ): {
    firstName: string;
    lastName: string;
  };
  injectBackend(backend: BaseNotificationBackend<Config>): void;
  injectLogger(logger: BaseLogger): void;
  renderFromTemplateContent(
    notification: AnyDatabaseNotification<Config>,
    templateContent: EmailTemplateContent,
    context: JsonObject,
  ): Promise<EmailTemplate>;
}
//# sourceMappingURL=base-notification-adapter.d.ts.map
