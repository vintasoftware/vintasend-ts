import type { StoredAttachment } from '../../types/attachment';
import type { JsonObject, JsonValue } from '../../types/json-values';
import type { AnyDatabaseNotification, DatabaseOneOffNotification } from '../../types/notification';
import type { NotificationType } from '../../types/notification-type';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';

/**
 * Type guard to check if a notification is a one-off notification
 */
export function isOneOffNotification<Config extends BaseNotificationTypeConfig>(
  notification: AnyDatabaseNotification<Config>,
): notification is DatabaseOneOffNotification<Config> {
  return (
    'emailOrPhone' in notification && 'firstName' in notification && 'lastName' in notification
  );
}

export abstract class BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> {
  key: string | null = null;
  backend: BaseNotificationBackend<Config> | null = null;
  logger: BaseLogger | null = null;

  constructor(
    protected templateRenderer: TemplateRenderer,
    public readonly notificationType: NotificationType,
    public readonly enqueueNotifications: boolean,
  ) {}

  send(_notification: AnyDatabaseNotification<Config>, _context: JsonValue): Promise<void> {
    if (this.backend === null) {
      return Promise.reject(new Error('Backend not injected'));
    }
    return Promise.resolve();
  }

  /**
   * Check if this adapter supports attachments
   */
  get supportsAttachments(): boolean {
    return false;
  }

  /**
   * Prepare attachments for sending
   * Override in adapters that support attachments
   */
  protected async prepareAttachments(attachments: StoredAttachment[]): Promise<unknown> {
    if (this.supportsAttachments && attachments.length > 0) {
      this.logger?.warn?.(
        `Adapter ${this.key} claims to support attachments but prepareAttachments is not implemented`,
      );
    }
    return null;
  }

  /**
   * Get the recipient email address from a notification.
   * For one-off notifications, returns the emailOrPhone field directly.
   * For regular notifications, fetches the email from the user via backend.
   */
  protected async getRecipientEmail(
    notification: AnyDatabaseNotification<Config>,
  ): Promise<string> {
    if (isOneOffNotification(notification)) {
      return notification.emailOrPhone;
    }

    // Regular notification - get from user via backend
    if (!this.backend) {
      throw new Error('Backend not injected');
    }

    const userEmail = await this.backend.getUserEmailFromNotification(notification.id);

    if (!userEmail) {
      throw new Error(`User email not found for notification ${notification.id}`);
    }

    return userEmail;
  }

  /**
   * Get the recipient name from a notification.
   * For one-off notifications, returns the firstName and lastName fields directly.
   * For regular notifications, attempts to extract from context or returns empty strings.
   */
  protected getRecipientName(
    notification: AnyDatabaseNotification<Config>,
    context: JsonValue,
  ): { firstName: string; lastName: string } {
    if (isOneOffNotification(notification)) {
      return {
        firstName: notification.firstName,
        lastName: notification.lastName,
      };
    }

    // Regular notification - try to get from context
    if (context && typeof context === 'object' && !Array.isArray(context)) {
      const jsonContext = context as JsonObject;
      return {
        firstName: (typeof jsonContext.firstName === 'string' ? jsonContext.firstName : '') || '',
        lastName: (typeof jsonContext.lastName === 'string' ? jsonContext.lastName : '') || '',
      };
    }

    return {
      firstName: '',
      lastName: '',
    };
  }

  injectBackend(backend: BaseNotificationBackend<Config>): void {
    this.backend = backend;
  }

  injectLogger(logger: BaseLogger): void {
    this.logger = logger;
  }
}
