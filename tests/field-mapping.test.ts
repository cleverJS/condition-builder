import { describe, expect, it } from 'vitest'

import { KendoFilterAdapter, MikroOrmConditionAdapter } from '../src/adapters'
import type { FieldNameMapping } from '../src/adapters'
import { ConditionBuilder } from '../src/builder'

describe('Field Name Mapping', () => {
  describe('Deserialization with KendoFilterAdapter', () => {
    const adapter = new KendoFilterAdapter()

    it('maps field names during deserialization', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'user_id', operator: 'eq' as const, value: 123 },
          { field: 'created_at', operator: 'gt' as const, value: '2023-01-01' },
        ],
      }

      // Map external field names (snake_case) to internal field names (camelCase)
      const fieldMapping: FieldNameMapping = {
        user_id: 'userId',
        created_at: 'createdAt',
      }

      const result = adapter.deserialize(kendoFilter, { fieldMapping }).build()

      expect(result).toEqual({
        $and: [
          { field: 'userId', op: '$eq', value: 123 },
          { field: 'createdAt', op: '$gt', value: '2023-01-01' },
        ],
      })
    })

    it('works without field mapping', () => {
      const kendoFilter = {
        field: 'name',
        operator: 'eq' as const,
        value: 'John',
      }

      const result = adapter.deserialize(kendoFilter).build()

      expect(result).toEqual({ field: 'name', op: '$eq', value: 'John' })
    })

    it('maps nested field names in complex filters', () => {
      const kendoFilter = {
        logic: 'or' as const,
        filters: [
          {
            logic: 'and' as const,
            filters: [
              { field: 'first_name', operator: 'eq' as const, value: 'John' },
              { field: 'last_name', operator: 'eq' as const, value: 'Doe' },
            ],
          },
          { field: 'email_address', operator: 'contains' as const, value: 'example.com' },
        ],
      }

      const fieldMapping: FieldNameMapping = {
        first_name: 'firstName',
        last_name: 'lastName',
        email_address: 'emailAddress',
      }

      const result = adapter.deserialize(kendoFilter, { fieldMapping }).build()

      expect(result).toEqual({
        $or: [
          {
            $and: [
              { field: 'firstName', op: '$eq', value: 'John' },
              { field: 'lastName', op: '$eq', value: 'Doe' },
            ],
          },
          { field: 'emailAddress', op: '$ilike', value: '%example.com%' },
        ],
      })
    })

    it('keeps unmapped field names as-is', () => {
      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'user_id', operator: 'eq' as const, value: 123 },
          { field: 'status', operator: 'eq' as const, value: 'active' },
        ],
      }

      const fieldMapping: FieldNameMapping = {
        user_id: 'userId',
        // status is not mapped
      }

      const result = adapter.deserialize(kendoFilter, { fieldMapping }).build()

      expect(result).toEqual({
        $and: [
          { field: 'userId', op: '$eq', value: 123 },
          { field: 'status', op: '$eq', value: 'active' }, // unchanged
        ],
      })
    })
  })

  describe('Serialization with MikroOrmConditionAdapter', () => {
    it('maps field names during serialization', () => {
      const adapter = new MikroOrmConditionAdapter()

      const condition = ConditionBuilder.create().where('userId', '$eq', 123).where('createdAt', '$gt', '2023-01-01').build()

      // Map internal field names (camelCase) to external field names (snake_case)
      const fieldMapping: FieldNameMapping = {
        userId: 'user_id',
        createdAt: 'created_at',
      }

      const result = adapter.serialize(condition, { fieldMapping })

      expect(result).toEqual({
        $and: [{ user_id: 123 }, { created_at: { $gt: '2023-01-01' } }],
      })
    })

    it('works without field mapping', () => {
      const adapter = new MikroOrmConditionAdapter()

      const condition = ConditionBuilder.create().where('name', '$eq', 'John').build()

      const result = adapter.serialize(condition)

      expect(result).toEqual({ name: 'John' })
    })

    it('maps nested field names in complex conditions', () => {
      const adapter = new MikroOrmConditionAdapter()

      const condition = ConditionBuilder.create()
        .andGroup((b) => b.where('firstName', '$eq', 'John').where('lastName', '$eq', 'Doe'))
        .orGroup((b) => b.where('emailAddress', '$like', '%example.com%'))
        .build()

      const fieldMapping: FieldNameMapping = {
        firstName: 'first_name',
        lastName: 'last_name',
        emailAddress: 'email_address',
      }

      const result = adapter.serialize(condition, { fieldMapping })

      expect(result).toEqual({
        $and: [{ $and: [{ first_name: 'John' }, { last_name: 'Doe' }] }, { email_address: { $like: '%example.com%' } }],
      })
    })

    it('keeps unmapped field names as-is', () => {
      const adapter = new MikroOrmConditionAdapter()

      const condition = ConditionBuilder.create().where('userId', '$eq', 123).where('status', '$eq', 'active').build()

      const fieldMapping: FieldNameMapping = {
        userId: 'user_id',
        // status is not mapped
      }

      const result = adapter.serialize(condition, { fieldMapping })

      expect(result).toEqual({
        $and: [{ user_id: 123 }, { status: 'active' }],
      })
    })

    it('handles null and between operators with field mapping', () => {
      const adapter = new MikroOrmConditionAdapter()

      const condition = ConditionBuilder.create().where('deletedAt', '$isnull').where('createdAt', '$between', ['2023-01-01', '2023-12-31']).build()

      const fieldMapping: FieldNameMapping = {
        deletedAt: 'deleted_at',
        createdAt: 'created_at',
      }

      const result = adapter.serialize(condition, { fieldMapping })

      expect(result).toEqual({
        $and: [{ deleted_at: null }, { created_at: { $gte: '2023-01-01', $lte: '2023-12-31' } }],
      })
    })
  })

  describe('Round-trip with field mapping', () => {
    it('deserializes and then serializes with consistent field mapping', () => {
      const kendoAdapter = new KendoFilterAdapter()
      const mikroAdapter = new MikroOrmConditionAdapter()

      const kendoFilter = {
        logic: 'and' as const,
        filters: [
          { field: 'user_id', operator: 'eq' as const, value: 123 },
          { field: 'email_address', operator: 'contains' as const, value: 'example' },
        ],
      }

      // Map external (snake_case) to internal (camelCase) for deserialization
      const deserializeMapping: FieldNameMapping = {
        user_id: 'userId',
        email_address: 'emailAddress',
      }

      // Map internal (camelCase) to database (snake_case) for serialization
      const serializeMapping: FieldNameMapping = {
        userId: 'user_id',
        emailAddress: 'email_address',
      }

      const condition = kendoAdapter.deserialize(kendoFilter, { fieldMapping: deserializeMapping }).build()

      // Verify internal representation uses camelCase
      expect(condition).toEqual({
        $and: [
          { field: 'userId', op: '$eq', value: 123 },
          { field: 'emailAddress', op: '$ilike', value: '%example%' },
        ],
      })

      const mikroQuery = mikroAdapter.serialize(condition, { fieldMapping: serializeMapping })

      // Verify final query uses snake_case
      expect(mikroQuery).toEqual({
        $and: [{ user_id: 123 }, { email_address: { $ilike: '%example%' } }],
      })
    })
  })
})
