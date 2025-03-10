# VintaSend TypeScript

A flexible package for implementing transactional notifications in TypeScript.

## Installation

```bash
npm install vintasend
# or
yarn add vintasend
```

## Features
* **Storing notifications in a Database**: This package relies on a data store to record all the notifications that will be sent. It also keeps it's state column up to date.
* **Scheduling notifications**: Storing notifications to be send in the future. The notification's context for rendering the template is only evaluated at the moment the notification is sent due to the lib's context generation registry.
* **Notification context fetched at send time**: On scheduled notifications, we only get the notification context at the send time, so we always get the most up-to-date information.
* **Flexible backend**: Your projects database is getting slow after you created the first milion notifications? You can migrate to a faster no-sql database with a blink of an eye without affecting how you send the notifications.
* **Flexible adapters**: Your project probably will need to change how it sends notifications overtime. This package allows to change the adapter without having to change how notifications templates are rendered or how the notification themselves are stored.
* **Flexible template renderers**: Wanna start managing your templates with a third party tool (so non-technical people can help maintaining them)? Or even choose a more powerful rendering engine? You can do it independently of how you send the notifications or store them in the database.

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Commercial Support

[![alt text](https://avatars2.githubusercontent.com/u/5529080?s=80&v=4 'Vinta Logo')](https://www.vinta.com.br/)

This project is maintained by [Vinta Software](https://www.vinta.com.br/) and is used in products of Vinta's clients. We are always looking for exciting work! If you need any commercial support, feel free to get in touch: contact@vinta.com.br
