import { join } from 'node:path';
import { PugEmailTemplateRenderer } from '../index';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { ContextGenerator } from 'vintasend/dist/services/notification-context-registry';


type MockConfig = {
  ContextMap: { testContext: ContextGenerator };
  NotificationIdType: string;
  UserIdType: string;
};

describe('PugEmailTemplateRenderer', () => {
  const fixturesPath = join(__dirname, 'fixtures');
  let renderer: PugEmailTemplateRenderer<MockConfig>;
  let mockNotification: DatabaseNotification<MockConfig> = {
    id: '123',
    notificationType: 'EMAIL' as const,
    contextName: 'testContext',
    contextParameters: {},
    userId: '456',
    title: 'Test Notification',
    bodyTemplate: join(fixturesPath, 'test-notification.pug'),
    subjectTemplate: join(fixturesPath, 'test-subject.pug'),
    extraParams: {},
    contextUsed: null,
    adapterUsed: null,
    status: 'PENDING_SEND' as const,
    sentAt: null,
    readAt: null,
    sendAfter: new Date(),
  };

  beforeEach(() => {
    renderer = new PugEmailTemplateRenderer();
    mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: join(fixturesPath, 'test-notification.pug'),
      subjectTemplate: join(fixturesPath, 'test-subject.pug'),
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      sendAfter: new Date(),
    };
  });

  it('should render email template with context', async () => {
    const context = {
      name: 'John',
      message: 'Hello World',
    };

    const result = await renderer.render(mockNotification, context);

    expect(result.subject).toBe('Welcome John');
    expect(result.body).toContain('Hello John!');
    expect(result.body).toContain('Your message: Hello World');
  });

  it('should throw error when subject template is missing', async () => {
    const notification = {
      ...mockNotification,
      id: 'test-notification',
      bodyTemplate: join(fixturesPath, 'test-notification.pug'),
      subjectTemplate: null,
      userId: 'user123',
    };

    await expect(renderer.render(notification, {})).rejects.toThrow(
      'Subject template is required'
    );
  });

  it('should handle empty context', async () => {
    const notification = {
      ...mockNotification,
      id: 'test-notification',
      bodyTemplate: join(fixturesPath, 'test-notification.pug'),
      subjectTemplate: join(fixturesPath, 'test-subject.pug'),
      userId: 'user123',
    };

    const result = await renderer.render(notification, {});

    expect(result.subject).toBe('Welcome ');
    expect(result.body).toContain('Hello !');
    expect(result.body).toContain('Your message: ');
  });

  it('should handle template compilation errors in subject template', async () => {
    const notification = {
      ...mockNotification,
      subjectTemplate: join(fixturesPath, 'non-existent-subject.pug'),
    };

    await expect(renderer.render(notification, {})).rejects.toThrow();
  });

  it('should handle template compilation errors in body template', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: join(fixturesPath, 'non-existent-body.pug'),
    };

    await expect(renderer.render(notification, {})).rejects.toThrow();
  });

  it('should handle template runtime errors', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: join(fixturesPath, 'invalid-template.pug'),
      subjectTemplate: join(fixturesPath, 'invalid-subject.pug'),
    };

    // Create invalid template files with syntax that will cause runtime errors
    await expect(
      renderer.render(notification, { undefinedVariable: undefined })
    ).rejects.toThrow();
  });
});
