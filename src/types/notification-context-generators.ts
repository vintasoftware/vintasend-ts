import type { JsonObject, JsonPrimitive } from './json-values.js';

export interface ContextGenerator<
  Params extends Record<string, JsonPrimitive> = Record<string, JsonPrimitive>,
> {
  generate(params: Params): JsonObject | Promise<JsonObject>;
}
