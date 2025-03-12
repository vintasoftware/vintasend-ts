import type {
  JsonObject,
  JsonPrimitive,
} from './json-values';

export interface ContextGenerator<
  Params extends Record<string, JsonPrimitive> = Record<string, JsonPrimitive>,
  Context extends JsonObject = JsonObject,
> {
  generate(params: Params): Context | Promise<Context>;
}
