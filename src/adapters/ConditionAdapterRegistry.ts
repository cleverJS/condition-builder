import { IAdapterPlugin } from './interfaces/IAdapterPlugin'
import { IConditionDeserializer, IConditionSerializer } from './interfaces/IConditionAdapter'

export class ConditionAdapterRegistry {
  // eslint-disable-next-line sonarjs/public-static-readonly -- mutable by design: deprecated singleton state, reset via resetInstance()
  static #instance: ConditionAdapterRegistry | null = null
  readonly #serializers = new Map<string, IConditionSerializer<any>>()
  readonly #deserializers = new Map<string, IConditionDeserializer<any>>()

  public constructor(plugins?: IAdapterPlugin[]) {
    if (plugins) {
      for (const plugin of plugins) {
        this.registerPlugin(plugin)
      }
    }
  }

  /**
   * @deprecated Use `new ConditionAdapterRegistry()` or `createConditionAdapterRegistry()` instead.
   * This method will be removed in a future major version.
   */
  public static getInstance(): ConditionAdapterRegistry {
    if (!ConditionAdapterRegistry.#instance) {
      ConditionAdapterRegistry.#instance = new ConditionAdapterRegistry()
    }
    return ConditionAdapterRegistry.#instance
  }

  /**
   * @deprecated Only needed for legacy singleton teardown in tests.
   * Prefer creating fresh instances with `new ConditionAdapterRegistry()` instead.
   */
  public static resetInstance(): void {
    ConditionAdapterRegistry.#instance = null
  }

  public registerPlugin(plugin: IAdapterPlugin): void {
    if (plugin.serializer) {
      this.#serializers.set(plugin.type, plugin.serializer)
    }
    if (plugin.deserializer) {
      this.#deserializers.set(plugin.type, plugin.deserializer)
    }
  }

  public register<TFormat>(type: string, serializer?: IConditionSerializer<TFormat>, deserializer?: IConditionDeserializer<TFormat>): void {
    if (serializer) {
      this.#serializers.set(type, serializer)
    }
    if (deserializer) {
      this.#deserializers.set(type, deserializer)
    }
  }

  public unregister(type: string): void {
    this.#serializers.delete(type)
    this.#deserializers.delete(type)
  }

  public getSerializer<TOutput>(type: string): IConditionSerializer<TOutput> {
    const serializer = this.#serializers.get(type)
    if (!serializer) {
      throw new Error(`Serializer '${type}' not registered`)
    }
    return serializer as IConditionSerializer<TOutput>
  }

  public getDeserializer<TInput>(type: string): IConditionDeserializer<TInput> {
    const deserializer = this.#deserializers.get(type)
    if (!deserializer) {
      throw new Error(`Deserializer '${type}' not registered`)
    }
    return deserializer as IConditionDeserializer<TInput>
  }

  public hasSerializer(type: string): boolean {
    return this.#serializers.has(type)
  }

  public hasDeserializer(type: string): boolean {
    return this.#deserializers.has(type)
  }

  public getRegisteredTypes(): string[] {
    const types = new Set<string>([...this.#serializers.keys(), ...this.#deserializers.keys()])
    return Array.from(types)
  }

  public clear(): void {
    this.#serializers.clear()
    this.#deserializers.clear()
  }
}

/**
 * Factory function to create a new `ConditionAdapterRegistry` with optional pre-registered plugins.
 *
 * @example
 * ```typescript
 * const registry = createConditionAdapterRegistry([
 *   { type: AdapterType.KNEX, serializer: new KnexConditionAdapter() },
 *   { type: AdapterType.KENDO, deserializer: new KendoFilterAdapter() },
 * ])
 * ```
 */
export function createConditionAdapterRegistry(plugins?: IAdapterPlugin[]): ConditionAdapterRegistry {
  return new ConditionAdapterRegistry(plugins)
}
