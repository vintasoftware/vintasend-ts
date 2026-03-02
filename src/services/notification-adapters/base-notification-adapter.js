/**
 * Type guard to check if a notification is a one-off notification
 */
export function isOneOffNotification(notification) {
    return ('emailOrPhone' in notification && 'firstName' in notification && 'lastName' in notification);
}
export class BaseNotificationAdapter {
    constructor(templateRenderer, notificationType, enqueueNotifications) {
        this.templateRenderer = templateRenderer;
        this.notificationType = notificationType;
        this.enqueueNotifications = enqueueNotifications;
        this.key = null;
        this.backend = null;
        this.logger = null;
    }
    send(_notification, _context) {
        if (this.backend === null) {
            return Promise.reject(new Error('Backend not injected'));
        }
        return Promise.resolve();
    }
    /**
     * Check if this adapter supports attachments
     */
    get supportsAttachments() {
        return false;
    }
    /**
     * Prepare attachments for sending
     * Override in adapters that support attachments
     */
    async prepareAttachments(attachments) {
        if (this.supportsAttachments && attachments.length > 0) {
            this.logger?.warn?.(`Adapter ${this.key} claims to support attachments but prepareAttachments is not implemented`);
        }
        return null;
    }
    /**
     * Get the recipient email address from a notification.
     * For one-off notifications, returns the emailOrPhone field directly.
     * For regular notifications, fetches the email from the user via backend.
     */
    async getRecipientEmail(notification) {
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
    getRecipientName(notification, context) {
        if (isOneOffNotification(notification)) {
            return {
                firstName: notification.firstName,
                lastName: notification.lastName,
            };
        }
        // Regular notification - try to get from context
        if (context && typeof context === 'object' && !Array.isArray(context)) {
            const jsonContext = context;
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
    injectBackend(backend) {
        this.backend = backend;
    }
    injectLogger(logger) {
        this.logger = logger;
    }
    async renderFromTemplateContent(notification, templateContent, context) {
        if (typeof this.templateRenderer.renderFromTemplateContent !== 'function') {
            throw new Error('Template renderer does not support renderFromTemplateContent.');
        }
        const rendered = await this.templateRenderer.renderFromTemplateContent(notification, templateContent, context);
        return rendered;
    }
}
