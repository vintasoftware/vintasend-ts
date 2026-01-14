# VintaSend TypeScript

A flexible package for implementing transactional notifications in TypeScript.

## Features

* **Storing notifications in a Database**: This package relies on a data store to record all the notifications that will be sent. It also keeps its state column up to date.
* **One-off notifications**: Send notifications directly to email addresses or phone numbers without requiring a user account. Perfect for prospects, guests, or external contacts.
* **File Attachments**: Attach files to notifications with flexible storage backend support (S3, Azure, GCS, local filesystem, etc.), automatic deduplication, and reusable file references.
* **Scheduling notifications**: Storing notifications to be sent in the future. The notification's context for rendering the template is only evaluated at the moment the notification is sent due to the lib's context generation registry.
* **Notification context fetched at send time**: On scheduled notifications, the package only gets the notification context (information to render the templates) at the send time, so we always get the most up-to-date information.
* **Flexible backend**: Your project's database is getting slow after you created the first million notifications? You can migrate to a faster NoSQL database in the blink of an eye without affecting how you send the notifications.
* **Flexible adapters**: Your project probably will need to change how it sends notifications over time. This package allows you to change the adapter without having to change how notification templates are rendered or how the notification themselves are stored.
* **Flexible template renderers**: Wanna start managing your templates with a third party tool (so non-technical people can help maintain them)? Or even choose a more powerful rendering engine? You can do it independently of how you send the notifications or store them in the database.
* **Sending notifications in background jobs**: This package supports using job queues to send notifications from separate processes. This may be helpful to free up the HTTP server of processing heavy notifications during the request time.

## How does it work?

The VintaSend package provides a NotificationService class that allows the user to store and send notifications, scheduled or not. It relies on Dependency Injection to define how to store/retrieve, render the notification templates, and send notifications. This architecture allows us to swap each part without changing the code we actually use to send the notifications.

### Scheduled Notifications

VintaSend schedules notifications by creating them on the database for sending when the `sendAfter` value has passed. The sending isn't done automatically but we have a service method called `sendPendingNotifications` to send all pending notifications found in the database.

You need to call the `sendPendingNotifications` service method in a cron job or a tool for running periodic jobs.

#### Keeping the content up-to-date in scheduled notifications

The VintaSend class stores every notification in a database. This helps us to audit and manage our notifications. At the same time, notifications usually have a context that's used to hydrate its template with data. If we stored the context directly on the notification records, we'd have to update it anytime the context changes. 

## Installation

```bash
npm install vintasend
# or
yarn add vintasend
```

## Getting Started

To start using VintaSend you just need to initialize the notification service and start using it to manage your notifications.


```typescript
import { VintaSendFactory } from 'vintasend';
import type { ContextGenerator } from 'vintasend';

// context generator for Welcome notification
class WelcomeContextGenerator extends ContextGenerator {
  async generate ({ userId }: { userId: number }): { firstName: string } {
    const user = await getUserById(userId);  // example
    return {
      firstName: user.firstName,
    };
  }
}

// context map for generating the context of each notification
export const contextGeneratorsMap = {
  welcome: new WelcomeContextGenerator(),
} as const;

// type config definition, so all modules use the same types
export type NotificationTypeConfig = {
  ContextMap: typeof contextGeneratorsMap;
  NotificationIdType: number;
  UserIdType: number;
};

export function getNotificationService() {
  /* 
   Function to instanciate the notificationService 
   The Backend, Template Renderer, Logger, and Adapter used here are not included
     here and should be installed and imported separately or manually defined if 
     the existing implementations don't support the specific use-case.
  */
  const backend = new MyNotificationBackendFactory<NotificationTypeConfig>().create();
  const templateRenderer = new MyNotificationAdapterFactory<NotificationTypeConfig>().create();
  const adapter = new MyNotificationAdapterFactory<NotificationTypeConfig>().create(
    templateRenderer, true
  );
  return new VintaSendFactory<NotificationTypeConfig>().create(
    [adapter],
    backend,
    new MyLogger(loggerOptions),
    contextGeneratorsMap,
  );
}

export function sendWelcomeEmail(userId: number) {
  /* sends the Welcome email to a user */
  const vintasend = getNotificationService();
  const now = new Date();

  vintasend.createNotification({
    userId: user.id,
    notificationType: 'EMAIL',
    title: 'Welcome Email',
    contextName: 'welcome',
    contextParameters: { userId },
    sendAfter: now,
    bodyTemplate: './src/email-templates/auth/welcome/welcome-body.html.template',
    subjectTemplate: './src/email-templates/auth/welcome/welcome-subject.txt.template',
    extraParams: {},
  });
} 
```

## Attachment Support

VintaSend supports file attachments for notifications with an extensible architecture that allows you to choose your preferred storage backend.

### Key Features

- ✅ **Flexible Storage** - Support for multiple backends (AWS S3, Azure Blob, Google Cloud Storage, local filesystem, etc.)
- ✅ **Reusable Files** - Upload once, attach to multiple notifications
- ✅ **Automatic Deduplication** - Files with identical content stored only once
- ✅ **Streaming Support** - Efficient handling of large files
- ✅ **Presigned URLs** - Secure, time-limited file access (backend-dependent)
- ✅ **Custom Backends** - Extensible interface to implement any storage service

### Quick Start

```typescript
// Example using S3 AttachmentManager (see available implementations below)
import { S3AttachmentManager } from 'vintasend-aws-s3-attachments';

// Create attachment manager (configuration varies by implementation)
const attachmentManager = new S3AttachmentManager({
  bucket: 'my-app-notifications',
  region: 'us-east-1',
  keyPrefix: 'attachments/',
});

// Create VintaSend with attachment support
const vintaSend = factory.create(
  adapters,
  backend,
  templateRenderer,
  contextGeneratorsMap,
  logger,
  attachmentManager, // Pass your chosen attachment manager
);

// Send notification with inline file upload
await vintaSend.sendNotification({
  notificationTypeId: 'order-confirmation',
  userId: '123',
  context: { orderNumber: 'ORD-12345' },
  attachments: [
    {
      file: invoiceBuffer,
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    },
  ],
});

// Send notification with pre-uploaded file reference
await vintaSend.sendNotification({
  notificationTypeId: 'welcome-email',
  userId: '456',
  context: { userName: 'John' },
  attachments: [
    {
      fileId: 'file-abc-123', // Reference to existing file
      description: 'Company brochure',
    },
  ],
});
```

### Complete Documentation

For comprehensive guides on attachment support, storage backends, security, and best practices, see [ATTACHMENTS.md](ATTACHMENTS.md).

Topics covered:
- Available storage backend implementations
- Creating custom AttachmentManagers for any storage service
- Security best practices and performance optimization
- Adapter support for sending attachments
- Usage examples and patterns

## One-Off Notifications

One-off notifications allow you to send notifications directly to an email address or phone number without requiring a user account in your system. This is particularly useful for:

- **Prospects**: Send welcome emails or marketing materials to potential customers
- **Guests**: Invite external participants to events or meetings
- **External Contacts**: Share information with partners or vendors
- **Temporary Recipients**: Send one-time notifications without creating user accounts

### Key Differences from Regular Notifications

| Feature | Regular Notification | One-Off Notification |
|---------|---------------------|----------------------|
| **Recipient** | User ID (requires account) | Email/phone directly |
| **User Data** | Fetched from user table | Provided inline (firstName, lastName) |
| **Use Case** | Registered users | Prospects, guests, external contacts |
| **Storage** | Same table with `userId` | Same table with `emailOrPhone` |

### Creating One-Off Notifications

```typescript
// Send an immediate one-off notification
const notification = await vintaSend.createOneOffNotification({
  emailOrPhone: 'prospect@example.com',
  firstName: 'John',
  lastName: 'Doe',
  notificationType: 'EMAIL',
  title: 'Welcome!',
  bodyTemplate: './templates/welcome.html',
  subjectTemplate: 'Welcome to {{companyName}}!',
  contextName: 'welcomeContext',
  contextParameters: { companyName: 'Acme Corp' },
  sendAfter: null, // Send immediately
  extraParams: null,
});
```

#### Using with Phone Numbers (SMS)

```typescript
// Send SMS to a phone number (requires SMS adapter)
const smsNotification = await vintaSend.createOneOffNotification({
  emailOrPhone: '+15551234567', // E.164 format recommended
  firstName: 'John',
  lastName: 'Doe',
  notificationType: 'SMS',
  title: 'Welcome SMS',
  bodyTemplate: './templates/welcome-sms.txt',
  subjectTemplate: null, // SMS doesn't use subjects
  contextName: 'welcomeContext',
  contextParameters: { companyName: 'Acme Corp' },
  sendAfter: null,
  extraParams: null,
});
```

### Database Schema Considerations

One-off notifications are stored in the same table as regular notifications using a unified approach:

- **Regular notifications**: Have `userId` set, `emailOrPhone` is null
- **One-off notifications**: Have `emailOrPhone` set, `userId` is null

### Migration Guide

If you're adding one-off notification support to an existing installation:

1. **Update your Prisma schema** to make `userId` optional and add one-off fields:
   ```bash
   # Add the new fields to your schema.prisma
   # Then run:
   prisma migrate dev --name add-one-off-notification-support
   ```

2. **No code changes required** for existing functionality - all existing notifications continue to work as before.

3. **Existing notifications are preserved** - they have `userId` set and `emailOrPhone` as null.

## Glossary

* **Notification Backend**: It is a class that implements the methods necessary for VintaSend services to create, update, and retrieve Notifications from the database.
* **Notification Adapter**: It is a class that implements the methods necessary for VintaSend services to send Notifications through email, SMS or even push/in-app notifications.
* **Template Renderer**: It is a class that implements the methods necessary for VintaSend adapter to render the notification body.
* **Notification Context**: It's the data passed to the templates to render the notification correctly. It's generated when the notification is sent, not on creation time
* **Context generator**: It's a class defined by the user context generator map with a context name. That class has a `generate` method that, when called, generates the data necessary to render its respective notification.
* **Context name**: The registered name of a context generator. It's stored in the notification so the context generator is called at the moment the notification will be sent.
* **Context generators map**: It's an object defined by the user that maps context names to their respective context generators.
* **Queue service**: Service for enqueueing notifications so they are sent by an external service.
* **Logger**: A class that allows the `NotificationService` to create logs following a format defined by its users.
* **One-off Notification**: A notification sent directly to an email address or phone number without requiring a user account. Used for prospects, guests, or external contacts.
* **Regular Notification**: A notification associated with a user account (via userId). Used for registered users in your system.
* **AttachmentManager**: A class that handles file storage operations (upload, download, delete) for notification attachments. Supports S3, Azure, GCS, and custom storage backends.
* **Attachment**: A file attached to a notification, either uploaded inline or referenced from previously uploaded files. Supports automatic deduplication and reuse across multiple notifications.  


## Implementations

### Community

VintaSend has many backend, adapter, and template renderer implementations. If you can't find something that fulfills your needs, the package has very clear interfaces you can implement and achieve the exact behavior you expect without loosing VintaSend's friendly API.

#### Officially supported packages 

##### Backends

* **[vintasend-prisma](https://github.com/vintasoftware/vintasend-prisma/)**: Uses Prisma Client to manage the notifications in the database.

##### Adapters

* **[vintasend-nodemailer](https://github.com/vintasoftware/vintasend-nodemailer/)**: Uses nodemailer to send transactional emails to users.

##### Attachment Managers

* **[vintasend-aws-s3-attachments](https://github.com/vintasoftware/vintasend-aws-s3-attachments/)**: AWS S3 storage backend with presigned URLs and streaming support. Also works with S3-compatible services (MinIO, DigitalOcean Spaces, Cloudflare R2, etc.).

##### Template Renderers
* **[vintasend-pug](https://github.com/vintasoftware/vintasend-pug/)**: Renders emails using Pug.

##### Loggers
* **[vintasend-winston](https://github.com/vintasoftware/vintasend-winston/)**: Uses Winston to allow `NotificationService` to create log entries.

## Examples

Examples of how to use VintaSend in different context are available on the [vintasend-ts-examples repository](https://github.com/vintasoftware/vintasend-ts-examples).

## Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
# or
yarn
```
3. Run tests:
```bash
npm test
# or
yarn test
```

## Contributing

Feel free to open issues and submit pull requests.

### Creating new implementations

There's a template project for creating new implementations that already includes basic dependencies, configuration for tests, and Github Actions hooks. You can find it in [vintasend-ts/src/implementations/vintasend-implementation-template](https://github.com/vintasoftware/vintasend-ts/tree/main/src/implementations/vintasend-implementation-template)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Commercial Support

[![alt text](https://avatars2.githubusercontent.com/u/5529080?s=80&v=4 'Vinta Logo')](https://www.vinta.com.br/)

This project is maintained by [Vinta Software](https://www.vinta.com.br/) and is used in products of Vinta's clients. We are always looking for exciting work! If you need any commercial support, feel free to get in touch: contact@vinta.com.br
