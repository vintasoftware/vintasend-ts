# VintaSend TypeScript

A flexible package for implementing transactional notifications in TypeScript.

## Features

* **Storing notifications in a Database**: This package relies on a data store to record all the notifications that will be sent. It also keeps it's state column up to date.
* **Scheduling notifications**: Storing notifications to be send in the future. The notification's context for rendering the template is only evaluated at the moment the notification is sent due to the lib's context generation registry.
* **Notification context fetched at send time**: On scheduled notifications, we only get the notification context at the send time, so we always get the most up-to-date information.
* **Flexible backend**: Your projects database is getting slow after you created the first milion notifications? You can migrate to a faster no-sql database with a blink of an eye without affecting how you send the notifications.
* **Flexible adapters**: Your project probably will need to change how it sends notifications overtime. This package allows to change the adapter without having to change how notifications templates are rendered or how the notification themselves are stored.
* **Flexible template renderers**: Wanna start managing your templates with a third party tool (so non-technical people can help maintaining them)? Or even choose a more powerful rendering engine? You can do it independently of how you send the notifications or store them in the database.
* **Sending notifications in background jobs**: This packages supports enqueing notifications to send it from separate processes. This may be helpful to free up the HTTP server of processing heavy notifications during the request time.

## How does it work?

The VintaSend package provides a NotificationService class that allows the user to store and send notification, scheduled or not. It relies on Dependency Injection to define how to store/retrieve, render the notification templates, and send notifications. This architechture allows us to swap each part without changing the code we actually use to send the notifications.

### Scheduled Notifications

VintaSend schedules notifications by creating them on the database for sending when the send_after value has passed. The sending isn't done automatically but we have a service method called `sendPendingNotifications` to send all pending notifications found in the database.

You need to call the `sendPendingNotifications` service method in a cron job or a tool for running periodic jobs.

#### Keeping the content up-to-date in scheduled notifications

The NotificationService stores every notification in a database. This helps us to audit and manage our notifications. At the same time, notifications usually have a context that's used to hydrate its template with data. If we stored the cotext directly on the notification records, we'd have to update it anytime the context changes. Instead of storing the context itself, we store a reference to a Context Generator class and the parameters it requires (like ids, flags, types, etc) so we generate the context only when the notification is sent. This ensures we're always getting the most up-to-date context when sending notifications. We also store the generated context after we send the notification, for auditing purposes.

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

## Glossary

* **Notification Backend**: It is a class that implements the methods necessary for VintaSend services to create, update, and retrieve Notifications from da database.
* **Notification Adapter**: It is a class that implements the methods necessary for VintaSend services to send Notifications through email, SMS or even push/in-app notifications.
* **Template Renderer**: It is a class that implements the methods necessary for VintaSend adapter to render the notification body.
* **Notification Context**: It's the data passed to the templates to render the notification correctly. It's generated when the notification is sent, not on creation time
* **Context generator**: It's a class defined by the user context generator map with a context name. That class has a `generate` method that, when called, generates the data necessary to render its respective notification.
* **Context name**: The registered name of a context generator. It's stored in the notification so the context generator is called at the moment the notification will be sent.
* **Context generators map**: It's an object defined by the user that maps context names to their respective context generators.
* **Queue service**: Service for enqueueing notifications so they are send by an external service.
* **Logger**: A class that allows the `NotificationService` to create logs following a format defined by its users.  


## Implementations


## Community

VintaSend has many backend, adapter, and template renderer implementations. If you can't find something that fulfills your needs, the package has very clear interfaces you can implement and achieve the exact behavior you expect without loosing VintaSend's friendly API.

### Officially supported packages 

#### Backends

* **[vintasend-prisma](https://github.com/vintasoftware/vintasend-prisma/)**: Uses Prisma Client to manage the notifications in the database.

#### Adapters

* **[vintasend-nodemailer](https://github.com/vintasoftware/vintasend-nodemailer/)**: Uses nodemailer to send transactional emails to users. 

#### Template Renderers
* **[vintasend-pug](https://github.com/vintasoftware/vintasend-pug/)**: Renders emails using Pug.

#### Loggers
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
