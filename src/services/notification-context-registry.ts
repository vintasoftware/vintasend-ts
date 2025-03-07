import type {
  JsonObject,
  JsonPrimitive,
} from '../types/json-values';

export interface ContextGenerator {
  generate(params: Record<string, JsonPrimitive>): JsonObject | Promise<JsonObject>;
}

export class NotificationContextRegistry<T extends Record<string, ContextGenerator>> {
  // biome-ignore lint/suspicious/noExplicitAny: This won't be used since we'll always initialize the registry
  private static instance: NotificationContextRegistry<any> | null = null;
  private readonly contexts: T;

  private constructor(contexts: T) {
    this.contexts = contexts;
  }

  public static initialize<T extends Record<string, ContextGenerator>>(
    contexts: T
  ): NotificationContextRegistry<T> {
    if (NotificationContextRegistry.instance) {
      throw new Error('NotificationContextRegistry already initialized');
    }
    NotificationContextRegistry.instance = new NotificationContextRegistry<T>(contexts);
    return NotificationContextRegistry.instance;
  }

  public static getInstance<T extends Record<string, ContextGenerator>>(): NotificationContextRegistry<T> {
    if (!NotificationContextRegistry.instance) {
      throw new Error('NotificationContextRegistry not initialized');
    }
    return NotificationContextRegistry.instance as NotificationContextRegistry<T>;
  }

  public static resetInstance(): void {
    NotificationContextRegistry.instance = null;
  }

  public async getContext<K extends keyof T>(key: K, parameters: Parameters<T[K]['generate']>[0]) {
    if (this.contexts[key].generate instanceof Promise) {
      return this.contexts[key].generate(parameters);
    }
    return Promise.resolve(this.contexts[key].generate(parameters));
  }

  public getAvailableContexts(): (keyof T)[] {
    return Object.keys(this.contexts) as (keyof T)[];
  }
}
