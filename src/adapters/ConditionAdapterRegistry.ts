import { IAdapterPlugin } from './interfaces/IAdapterPlugin'
import { IConditionDeserializer, IConditionSerializer } from './interfaces/IConditionAdapter'

export class ConditionAdapterRegistry {
  private static instance: ConditionAdapterRegistry
  private readonly serializers = new Map<string, IConditionSerializer<any>>()
  private readonly deserializers = new Map<string, IConditionDeserializer<any>>()

  private constructor() {}

  public static getInstance(): ConditionAdapterRegistry {
    if (!ConditionAdapterRegistry.instance) {
      ConditionAdapterRegistry.instance = new ConditionAdapterRegistry()
    }
    return ConditionAdapterRegistry.instance
  }

  public registerPlugin(plugin: IAdapterPlugin): void {
    if (plugin.serializer) {
      this.serializers.set(plugin.type, plugin.serializer)
    }
    if (plugin.deserializer) {
      this.deserializers.set(plugin.type, plugin.deserializer)
    }
  }

  public register<TFormat>(type: string, serializer?: IConditionSerializer<TFormat>, deserializer?: IConditionDeserializer<TFormat>): void {
    if (serializer) {
      this.serializers.set(type, serializer)
    }
    if (deserializer) {
      this.deserializers.set(type, deserializer)
    }
  }

  public unregister(type: string): void {
    this.serializers.delete(type)
    this.deserializers.delete(type)
  }

  public getSerializer<TOutput>(type: string): IConditionSerializer<TOutput> {
    const serializer = this.serializers.get(type)
    if (!serializer) {
      throw new Error(`Serializer '${type}' not registered`)
    }
    return serializer as IConditionSerializer<TOutput>
  }

  public getDeserializer<TInput>(type: string): IConditionDeserializer<TInput> {
    const deserializer = this.deserializers.get(type)
    if (!deserializer) {
      throw new Error(`Deserializer '${type}' not registered`)
    }
    return deserializer as IConditionDeserializer<TInput>
  }

  public hasSerializer(type: string): boolean {
    return this.serializers.has(type)
  }

  public hasDeserializer(type: string): boolean {
    return this.deserializers.has(type)
  }

  public getRegisteredTypes(): string[] {
    const types = new Set<string>([...this.serializers.keys(), ...this.deserializers.keys()])
    return Array.from(types)
  }

  public clear(): void {
    this.serializers.clear()
    this.deserializers.clear()
  }
}
