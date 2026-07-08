import { describe, expect, it } from 'vitest'

import {
  AdapterType,
  Condition,
  ConditionAdapterRegistry,
  ConditionBuilder,
  createConditionAdapterRegistry,
  IConditionDeserializer,
  IConditionSerializer,
} from '../src'

describe('ConditionAdapterRegistry', () => {
  it('should register and retrieve serializers', () => {
    const registry = new ConditionAdapterRegistry()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }

    registry.register('json', mockSerializer)

    expect(registry.hasSerializer('json')).toBe(true)
    const retrieved = registry.getSerializer<string>('json')
    expect(retrieved).toBe(mockSerializer)
  })

  it('should register and retrieve deserializers', () => {
    const registry = new ConditionAdapterRegistry()
    const mockDeserializer: IConditionDeserializer<string> = {
      deserialize: (input: string) => new ConditionBuilder(),
    }

    registry.register('json', undefined, mockDeserializer)

    expect(registry.hasDeserializer('json')).toBe(true)
    const retrieved = registry.getDeserializer<string>('json')
    expect(retrieved).toBe(mockDeserializer)
  })

  it('should register adapters via plugin interface', () => {
    const registry = new ConditionAdapterRegistry()
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
    const registry = new ConditionAdapterRegistry()

    expect(() => registry.getSerializer('nonexistent')).toThrow('Serializer \'nonexistent\' not registered')
  })

  it('should throw error for unregistered deserializer', () => {
    const registry = new ConditionAdapterRegistry()

    expect(() => registry.getDeserializer('nonexistent')).toThrow('Deserializer \'nonexistent\' not registered')
  })

  it('should unregister adapters', () => {
    const registry = new ConditionAdapterRegistry()
    const mockSerializer: IConditionSerializer<string> = {
      serialize: (condition: Condition) => JSON.stringify(condition),
    }

    registry.register('temp', mockSerializer)
    expect(registry.hasSerializer('temp')).toBe(true)

    registry.unregister('temp')
    expect(registry.hasSerializer('temp')).toBe(false)
  })

  it('should list registered types', () => {
    const registry = new ConditionAdapterRegistry()
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
    const registry = new ConditionAdapterRegistry()
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

  describe('constructor with plugins', () => {
    it('should pre-register plugins passed to constructor', () => {
      const mockSerializer: IConditionSerializer<string> = {
        serialize: (condition: Condition) => JSON.stringify(condition),
      }
      const mockDeserializer: IConditionDeserializer<string> = {
        deserialize: (input: string) => new ConditionBuilder(),
      }

      const registry = new ConditionAdapterRegistry([
        { type: 'json', serializer: mockSerializer, deserializer: mockDeserializer },
        { type: 'custom', serializer: mockSerializer },
      ])

      expect(registry.hasSerializer('json')).toBe(true)
      expect(registry.hasDeserializer('json')).toBe(true)
      expect(registry.hasSerializer('custom')).toBe(true)
      expect(registry.hasDeserializer('custom')).toBe(false)
    })

    it('should work with empty plugins array', () => {
      const registry = new ConditionAdapterRegistry([])

      expect(registry.getRegisteredTypes().length).toBe(0)
    })

    it('should work with no arguments', () => {
      const registry = new ConditionAdapterRegistry()

      expect(registry.getRegisteredTypes().length).toBe(0)
    })
  })

  describe('createConditionAdapterRegistry factory', () => {
    it('should create a registry with plugins', () => {
      const mockSerializer: IConditionSerializer<string> = {
        serialize: (condition: Condition) => JSON.stringify(condition),
      }

      const registry = createConditionAdapterRegistry([{ type: 'test', serializer: mockSerializer }])

      expect(registry).toBeInstanceOf(ConditionAdapterRegistry)
      expect(registry.hasSerializer('test')).toBe(true)
    })

    it('should create an empty registry without arguments', () => {
      const registry = createConditionAdapterRegistry()

      expect(registry).toBeInstanceOf(ConditionAdapterRegistry)
      expect(registry.getRegisteredTypes().length).toBe(0)
    })
  })

  describe('deprecated singleton (backward compatibility)', () => {
    it('should return the same instance from getInstance()', () => {
      ConditionAdapterRegistry.resetInstance()
      const instance1 = ConditionAdapterRegistry.getInstance()
      const instance2 = ConditionAdapterRegistry.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should reset the singleton instance', () => {
      const instance1 = ConditionAdapterRegistry.getInstance()
      ConditionAdapterRegistry.resetInstance()
      const instance2 = ConditionAdapterRegistry.getInstance()

      expect(instance1).not.toBe(instance2)
    })

    it('should create independent instances with new', () => {
      const registry1 = new ConditionAdapterRegistry()
      const registry2 = new ConditionAdapterRegistry()

      expect(registry1).not.toBe(registry2)

      const mockSerializer: IConditionSerializer<string> = {
        serialize: (condition: Condition) => JSON.stringify(condition),
      }

      registry1.register('only-in-1', mockSerializer)

      expect(registry1.hasSerializer('only-in-1')).toBe(true)
      expect(registry2.hasSerializer('only-in-1')).toBe(false)
    })
  })
})
