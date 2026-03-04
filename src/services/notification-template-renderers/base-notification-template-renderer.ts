import type { JsonObject } from '../../types/json-values.js';
import type { AnyNotification } from '../../types/notification.js';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';
import type { BaseLogger } from '../loggers/base-logger.js';

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

  injectLogger(logger: BaseLogger): void {
    this.logger = logger;
  }
}
