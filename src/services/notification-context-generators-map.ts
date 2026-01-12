import type { ContextGenerator } from '../types/notification-context-generators';

export class NotificationContextGeneratorsMap<
  ContextMapType extends { [key: string]: ContextGenerator },
> {
  private contextGenerators: ContextMapType;

  constructor(contextGenerators: ContextMapType) {
    this.contextGenerators = contextGenerators;
  }

  getContextGenerator<ContextName extends string & keyof ContextMapType>(
    contextName: ContextName,
  ): ContextMapType[ContextName] {
    return this.contextGenerators[contextName];
  }
}
