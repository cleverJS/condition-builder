import { describe, expect, it } from 'vitest'

import { KendoFilterAdapter } from '../src/adapters'

describe('KendoFilterAdapter', () => {
  const adapter = new KendoFilterAdapter()

  describe('Simple filters', () => {
    it('converts eq operator', () => {
      const kendoFilter = {
        field: 'name',
        operator: 'eq' as const,
        value: 'John',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'name', op: '$eq', value: 'John' })
    })

    it('converts neq operator', () => {
      const kendoFilter = {
        field: 'status',
        operator: 'neq' as const,
        value: 'inactive',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'status', op: '$ne', value: 'inactive' })
    })

    it('converts gt operator', () => {
      const kendoFilter = {
        field: 'age',
        operator: 'gt' as const,
        value: 25,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'age', op: '$gt', value: 25 })
    })

    it('converts gte operator', () => {
      const kendoFilter = {
        field: 'price',
        operator: 'gte' as const,
        value: 100,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'price', op: '$gte', value: 100 })
    })

    it('converts lt operator', () => {
      const kendoFilter = {
        field: 'score',
        operator: 'lt' as const,
        value: 50,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'score', op: '$lt', value: 50 })
    })

    it('converts lte operator', () => {
      const kendoFilter = {
        field: 'quantity',
        operator: 'lte' as const,
        value: 10,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'quantity', op: '$lte', value: 10 })
    })

    it('converts contains operator', () => {
      const kendoFilter = {
        field: 'description',
        operator: 'contains' as const,
        value: 'test',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'description', op: '$ilike', value: '%test%' })
    })

    it('converts doesnotcontain operator', () => {
      const kendoFilter = {
        field: 'text',
        operator: 'doesnotcontain' as const,
        value: 'spam',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'text', op: '$notlike', value: '%spam%' })
    })

    it('converts startswith operator', () => {
      const kendoFilter = {
        field: 'email',
        operator: 'startswith' as const,
        value: 'admin',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'email', op: '$ilike', value: 'admin%' })
    })

    it('converts endswith operator', () => {
      const kendoFilter = {
        field: 'email',
        operator: 'endswith' as const,
        value: '@example.com',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'email', op: '$ilike', value: '%@example.com' })
    })

    it('converts isnull operator', () => {
      const kendoFilter = {
        field: 'deletedAt',
        operator: 'isnull' as const,
        value: null,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'deletedAt', op: '$isnull' })
    })

    it('converts isnotnull operator', () => {
      const kendoFilter = {
        field: 'updatedAt',
        operator: 'isnotnull' as const,
        value: null,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'updatedAt', op: '$notnull' })
    })

    it('converts isempty operator', () => {
      const kendoFilter = {
        field: 'notes',
        operator: 'isempty' as const,
        value: '',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'notes', op: '$eq', value: '' })
    })

    it('converts isnotempty operator', () => {
      const kendoFilter = {
        field: 'comments',
        operator: 'isnotempty' as const,
        value: '',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'comments', op: '$ne', value: '' })
    })

    it('converts in operator', () => {
      const kendoFilter = {
        field: 'status',
        operator: 'in' as const,
        value: ['active', 'pending', 'approved'],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'status', op: '$in', value: ['active', 'pending', 'approved'] })
    })

    it('converts isnullorempty operator', () => {
      const kendoFilter = {
        field: 'optionalField',
        operator: 'isnullorempty' as const,
        value: null,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $or: [
          { field: 'optionalField', op: '$isnull' },
          { field: 'optionalField', op: '$eq', value: '' },
        ],
      })
    })

    it('converts isnotnullorempty operator', () => {
      const kendoFilter = {
        field: 'requiredField',
        operator: 'isnotnullorempty' as const,
        value: null,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $and: [
          { field: 'requiredField', op: '$notnull' },
          { field: 'requiredField', op: '$ne', value: '' },
        ],
      })
    })

    it('converts doesnotstartwith operator', () => {
      const kendoFilter = {
        field: 'email',
        operator: 'doesnotstartwith' as const,
        value: 'spam',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'email', op: '$notlike', value: 'spam%' })
    })

    it('converts doesnotendwith operator', () => {
      const kendoFilter = {
        field: 'filename',
        operator: 'doesnotendwith' as const,
        value: '.tmp',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'filename', op: '$notlike', value: '%.tmp' })
    })
  })

  describe('Case-insensitive operator handling', () => {
    it('handles uppercase operators', () => {
      const kendoFilter = {
        field: 'name',
        operator: 'EQ' as any,
        value: 'John',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'name', op: '$eq', value: 'John' })
    })

    it('handles mixed case operators', () => {
      const kendoFilter = {
        field: 'description',
        operator: 'StartsWith' as any,
        value: 'Test',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'description', op: '$ilike', value: 'Test%' })
    })

    it('handles uppercase composite operators', () => {
      const kendoFilter = {
        field: 'field',
        operator: 'ISNULLOREMPTY' as any,
        value: null,
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $or: [
          { field: 'field', op: '$isnull' },
          { field: 'field', op: '$eq', value: '' },
        ],
      })
    })
  })

  describe('Composite filters', () => {
    it('converts AND composite filter', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'name', operator: 'eq' as const, value: 'John' },
          { field: 'age', operator: 'gt' as const, value: 25 },
        ],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $and: [
          { field: 'name', op: '$eq', value: 'John' },
          { field: 'age', op: '$gt', value: 25 },
        ],
      })
    })

    it('converts OR composite filter', () => {
      const kendoFilter = {
        logic: 'or' as const,
        filters: [
          { field: 'status', operator: 'eq' as const, value: 'active' },
          { field: 'status', operator: 'eq' as const, value: 'pending' },
        ],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $or: [
          { field: 'status', op: '$eq', value: 'active' },
          { field: 'status', op: '$eq', value: 'pending' },
        ],
      })
    })

    it('converts nested composite filters', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'category', operator: 'eq' as const, value: 'electronics' },
          {
            logic: 'or' as const,
            filters: [
              { field: 'price', operator: 'lt' as const, value: 100 },
              { field: 'onSale', operator: 'eq' as const, value: true },
            ],
          },
        ],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $and: [
          { field: 'category', op: '$eq', value: 'electronics' },
          {
            $or: [
              { field: 'price', op: '$lt', value: 100 },
              { field: 'onSale', op: '$eq', value: true },
            ],
          },
        ],
      })
    })

    it('converts deeply nested composite filters', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'isActive', operator: 'eq' as const, value: true },
          {
            logic: 'or' as const,
            filters: [
              {
                logic: 'and' as const,
                filters: [
                  { field: 'name', operator: 'startswith' as const, value: 'A' },
                  { field: 'age', operator: 'gte' as const, value: 18 },
                ],
              },
              { field: 'premium', operator: 'eq' as const, value: true },
            ],
          },
        ],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $and: [
          { field: 'isActive', op: '$eq', value: true },
          {
            $or: [
              {
                $and: [
                  { field: 'name', op: '$ilike', value: 'A%' },
                  { field: 'age', op: '$gte', value: 18 },
                ],
              },
              { field: 'premium', op: '$eq', value: true },
            ],
          },
        ],
      })
    })

    it('handles empty filter arrays', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $and: [],
      })
    })
  })

  describe('Complex real-world scenarios', () => {
    it('converts a complex e-commerce filter', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'category', operator: 'eq' as const, value: 'laptops' },
          { field: 'inStock', operator: 'eq' as const, value: true },
          {
            logic: 'or' as const,
            filters: [
              { field: 'brand', operator: 'eq' as const, value: 'Dell' },
              { field: 'brand', operator: 'eq' as const, value: 'HP' },
              { field: 'brand', operator: 'eq' as const, value: 'Lenovo' },
            ],
          },
          {
            logic: 'and' as const,
            filters: [
              { field: 'price', operator: 'gte' as const, value: 500 },
              { field: 'price', operator: 'lte' as const, value: 2000 },
            ],
          },
        ],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $and: [
          { field: 'category', op: '$eq', value: 'laptops' },
          { field: 'inStock', op: '$eq', value: true },
          {
            $or: [
              { field: 'brand', op: '$eq', value: 'Dell' },
              { field: 'brand', op: '$eq', value: 'HP' },
              { field: 'brand', op: '$eq', value: 'Lenovo' },
            ],
          },
          {
            $and: [
              { field: 'price', op: '$gte', value: 500 },
              { field: 'price', op: '$lte', value: 2000 },
            ],
          },
        ],
      })
    })

    it('converts a search filter with text operations', () => {
      const kendoFilter = {
        logic: 'or' as const,
        filters: [
          { field: 'title', operator: 'contains' as const, value: 'javascript' },
          { field: 'description', operator: 'contains' as const, value: 'javascript' },
          { field: 'tags', operator: 'contains' as const, value: 'javascript' },
        ],
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({
        $or: [
          { field: 'title', op: '$ilike', value: '%javascript%' },
          { field: 'description', op: '$ilike', value: '%javascript%' },
          { field: 'tags', op: '$ilike', value: '%javascript%' },
        ],
      })
    })
  })

  describe('Error handling', () => {
    it('throws error for unsupported operator', () => {
      const kendoFilter = {
        field: 'test',
        operator: 'unsupported' as any,
        value: 'value',
      }

      expect(() => adapter.deserialize(kendoFilter)).toThrow('Unsupported Kendo operator: unsupported')
    })
  })

  describe('Builder continuation after deserialization', () => {
    it('allows continuing to build after deserializing a simple filter', () => {
      const kendoFilter = {
        field: 'status',
        operator: 'eq' as const,
        value: 'active',
      }

      const builder = adapter.deserialize(kendoFilter)
      builder.where('age').gt(18)
      const result = builder.build()

      expect(result).toEqual({
        $and: [
          { field: 'status', op: '$eq', value: 'active' },
          { field: 'age', op: '$gt', value: 18 },
        ],
      })
    })

    it('allows adding conditions after deserializing a composite filter', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'category', operator: 'eq' as const, value: 'electronics' },
          { field: 'price', operator: 'lt' as const, value: 100 },
        ],
      }

      const builder = adapter.deserialize(kendoFilter)
      builder.where('deletedAt').isNull()
      builder.orGroup((g) => {
        g.where('featured').eq(true)
        g.where('onSale').eq(true)
      })
      const result = builder.build()

      expect(result).toEqual({
        $and: [
          { field: 'category', op: '$eq', value: 'electronics' },
          { field: 'price', op: '$lt', value: 100 },
          { field: 'deletedAt', op: '$isnull' },
          {
            $or: [
              { field: 'featured', op: '$eq', value: true },
              { field: 'onSale', op: '$eq', value: true },
            ],
          },
        ],
      })
    })

    it('returns a ConditionBuilder instance', () => {
      const kendoFilter = {
        field: 'name',
        operator: 'eq' as const,
        value: 'John',
      }

      const builder = adapter.deserialize(kendoFilter)

      // Verify it's a ConditionBuilder with the expected methods
      expect(builder).toHaveProperty('where')
      expect(builder).toHaveProperty('andGroup')
      expect(builder).toHaveProperty('orGroup')
      expect(builder).toHaveProperty('build')
    })
  })
})

