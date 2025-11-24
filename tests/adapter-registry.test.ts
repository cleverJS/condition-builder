import { beforeEach, describe, expect, it } from 'vitest'

import { AdapterType, Condition, ConditionAdapterRegistry, ConditionBuilder, IConditionDeserializer, IConditionSerializer } from '../src'

describe('ConditionAdapterRegistry', () => {
  beforeEach(() => {
    ConditionAdapterRegistry.getInstance().clear()
  })

  it('should be a singleton', () => {
    const instance1 = ConditionAdapterRegistry.getInstance()
    const instance2 = ConditionAdapterRegistry.getInstance()

    expect(instance1).toBe(instance2)
  })

  it('should register and retrieve serializers', () => {
    const registry = ConditionAdapterRegistry.getInstance()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }

    registry.register('json', mockSerializer)

    expect(registry.hasSerializer('json')).toBe(true)
    const retrieved = registry.getSerializer<string>('json')
    expect(retrieved).toBe(mockSerializer)
  })

  it('should register and retrieve deserializers', () => {
    const registry = ConditionAdapterRegistry.getInstance()
    const mockDeserializer: IConditionDeserializer<string> = {
      deserialize: (input: string) => new ConditionBuilder(),
    }

    registry.register('json', undefined, mockDeserializer)

    expect(registry.hasDeserializer('json')).toBe(true)
    const retrieved = registry.getDeserializer<string>('json')
    expect(retrieved).toBe(mockDeserializer)
  })

  it('should register adapters via plugin interface', () => {
    const registry = ConditionAdapterRegistry.getInstance()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }
    const mockDeserializer: IConditionDeserializer<string> = {
      deserialize: (input: string) => new ConditionBuilder(),
    }

    registry.registerPlugin({
      type: 'custom',
      serializer: mockSerializer,
      deserializer: mockDeserializer,
    })

    expect(registry.hasSerializer('custom')).toBe(true)
    expect(registry.hasDeserializer('custom')).toBe(true)
  })

  it('should throw error for unregistered serializer', () => {
    const registry = ConditionAdapterRegistry.getInstance()

    expect(() => registry.getSerializer('nonexistent')).toThrow("Serializer 'nonexistent' not registered")
  })

  it('should throw error for unregistered deserializer', () => {
    const registry = ConditionAdapterRegistry.getInstance()

    expect(() => registry.getDeserializer('nonexistent')).toThrow("Deserializer 'nonexistent' not registered")
  })

  it('should unregister adapters', () => {
    const registry = ConditionAdapterRegistry.getInstance()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }

    registry.register('temp', mockSerializer)
    expect(registry.hasSerializer('temp')).toBe(true)

    registry.unregister('temp')
    expect(registry.hasSerializer('temp')).toBe(false)
  })

  it('should list registered types', () => {
    const registry = ConditionAdapterRegistry.getInstance()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }

    registry.register('type1', mockSerializer)
    registry.register('type2', undefined, mockSerializer as any)

    const types = registry.getRegisteredTypes()
    expect(types).toContain('type1')
    expect(types).toContain('type2')
    expect(types.length).toBe(2)
  })

  it('should clear all registrations', () => {
    const registry = ConditionAdapterRegistry.getInstance()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }

    registry.register('type1', mockSerializer)
    registry.register('type2', mockSerializer)

    registry.clear()

    expect(registry.getRegisteredTypes().length).toBe(0)
  })

  it('should have AdapterType constants', () => {
    expect(AdapterType.KNEX).toBe('knex')
    expect(AdapterType.MIKROORM).toBe('mikroorm')
    expect(AdapterType.KENDO).toBe('kendo')
  })
})
