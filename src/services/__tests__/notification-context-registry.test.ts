import { NotificationContextRegistry } from '../notification-context-registry';

describe('NotificationContextRegistry', () => {
  beforeEach(() => {
    // Reset the singleton instance between tests
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (NotificationContextRegistry as any).instance = null;
  });

  const mockContexts = {
    user: {
      generate: (params: { userId: string }) => ({
        id: params.userId,
        name: 'Test User',
      }),
    },
    order: {
      generate: async (params: { orderId: string }) => ({
        id: params.orderId,
        total: 100,
      }),
    },
  };

  it('should initialize with contexts', () => {
    const registry = NotificationContextRegistry.initialize(mockContexts);
    expect(registry).toBeInstanceOf(NotificationContextRegistry);
  });

  it('should throw error when initializing twice', () => {
    NotificationContextRegistry.initialize(mockContexts);
    expect(() => NotificationContextRegistry.initialize(mockContexts)).toThrow(
      'NotificationContextRegistry already initialized'
    );
  });

  it('should throw error when getting instance before initialization', () => {
    expect(() => NotificationContextRegistry.getInstance()).toThrow(
      'NotificationContextRegistry not initialized'
    );
  });

  it('should return context for synchronous generator', async () => {
    const registry = NotificationContextRegistry.initialize(mockContexts);
    const context = await registry.getContext('user', { userId: '123' });
    expect(context).toEqual({
      id: '123',
      name: 'Test User',
    });
  });

  it('should return context for asynchronous generator', async () => {
    const registry = NotificationContextRegistry.initialize(mockContexts);
    const context = await registry.getContext('order', { orderId: '456' });
    expect(context).toEqual({
      id: '456',
      total: 100,
    });
  });

  it('should return available contexts', () => {
    const registry = NotificationContextRegistry.initialize(mockContexts);
    const contexts = registry.getAvailableContexts();
    expect(contexts).toEqual(['user', 'order']);
  });
});
