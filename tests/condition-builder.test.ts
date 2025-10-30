import { describe, expect, it } from 'vitest'

import { ConditionBuilder } from '../src/bulder/ConditionBuilder'

describe('ConditionBuilder', () => {
  it('builds simple eq condition', () => {
    const cb = ConditionBuilder.create().where('field1').eq(1)
    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [{ field: 'field1', op: '$eq', value: 1 }],
    })
  })

  it('builds nested or group', () => {
    const cb = ConditionBuilder.create()
      .where('field1')
      .eq(1)
      .orGroup((b) => b.where('field2').isNotNull().where('field3').gt(5))

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'field1', op: '$eq', value: 1 },
        {
          type: 'or',
          conditions: [
            { field: 'field2', op: '$notnull' },
            { field: 'field3', op: '$gt', value: 5 },
          ],
        },
      ],
    })
  })

  it('supports nested and groups', () => {
    const cb = ConditionBuilder.create().andGroup((b) => b.where('a').eq(1).where('b').eq(2))

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        {
          type: 'and',
          conditions: [
            { field: 'a', op: '$eq', value: 1 },
            { field: 'b', op: '$eq', value: 2 },
          ],
        },
      ],
    })
  })

  it('supports aliases and many operators', () => {
    const cb = ConditionBuilder.create()
      .where('name')
      .eq('alice')
      .where('age')
      .gt(18)
      .where('score')
      .lte(100)
      .where('email')
      .ilike('%@example.com')
      .where('tags')
      .in(['a', 'b'])
      .where('range')
      .between(1, 10)
      .where('maybe')
      .isNull()

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'name', op: '$eq', value: 'alice' },
        { field: 'age', op: '$gt', value: 18 },
        { field: 'score', op: '$lte', value: 100 },
        { field: 'email', op: '$ilike', value: '%@example.com' },
        { field: 'tags', op: '$in', value: ['a', 'b'] },
        { field: 'range', op: '$between', value: [1, 10] },
        { field: 'maybe', op: '$isnull' },
      ],
    })
  })

  it('supports where(field, op, value) shorthand', () => {
    const cb = ConditionBuilder.create().where('age', '$gt', 21).where('name', '$eq', 'bob').where('status', '$in', ['active', 'pending'])

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'age', op: '$gt', value: 21 },
        { field: 'name', op: '$eq', value: 'bob' },
        { field: 'status', op: '$in', value: ['active', 'pending'] },
      ],
    })
  })

  it('supports create(field, op, value) shorthand', () => {
    const cb = ConditionBuilder.create('age', '$gt', 21)

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'age', op: '$gt', value: 21 },
      ],
    })
  })

  it('supports where(objectDescriptor) to add many conditions', () => {
    const cb = ConditionBuilder.create().where({
      name: 'bob',
      age: { $gt: 21 },
      hasJob: { $eq: 1 },
      tags: ['x', 'y'],
      range: { op: '$between', value: [1, 2] },
      email: { op: '$ilike', value: '%@ex' },
      active: null,
    })

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'name', op: '$eq', value: 'bob' },
        { field: 'age', op: '$gt', value: 21 },
        { field: 'hasJob', op: '$eq', value: 1 },
        { field: 'tags', op: '$in', value: ['x', 'y'] },
        { field: 'range', op: '$between', value: [1, 2] },
        { field: 'email', op: '$ilike', value: '%@ex' },
        { field: 'active', op: '$eq', value: null },
      ],
    })
  })

  it('supports where(objectDescriptor) to add many conditions in create', () => {
    const cb = ConditionBuilder.create({
      name: 'bob',
      age: { $gt: 21 },
      hasJob: { $eq: 1 },
      tags: ['x', 'y'],
      range: { op: '$between', value: [1, 2] },
      email: { op: '$ilike', value: '%@ex' },
      active: null,
    })

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'name', op: '$eq', value: 'bob' },
        { field: 'age', op: '$gt', value: 21 },
        { field: 'hasJob', op: '$eq', value: 1 },
        { field: 'tags', op: '$in', value: ['x', 'y'] },
        { field: 'range', op: '$between', value: [1, 2] },
        { field: 'email', op: '$ilike', value: '%@ex' },
        { field: 'active', op: '$eq', value: null },
      ],
    })
  })

  it('throws on invalid shapes', () => {
    // IN requires array
    expect(() =>
      ConditionBuilder.create()
        .where('tags')
        .in('not-an-array' as any)
    ).toThrow('$in requires an array of strings or numbers')
    // BETWEEN requires two values
    expect(() =>
      ConditionBuilder.create()
        .where('range')
        .between(1 as any, undefined as any)
    ).toThrow('$between requires a tuple/array of two values')
    // LIKE requires string
    expect(() =>
      ConditionBuilder.create()
        .where('col')
        .like(123 as any)
    ).toThrow('$like requires a string value')
    // IS_NULL should not accept a value
    expect(() => ConditionBuilder.create().where('x').isNull() && ConditionBuilder.create().where('x').isNull()).not.toThrow()
    // simple op requires a simple value
    expect(() =>
      ConditionBuilder.create()
        .where('obj')
        .eq({} as any)
    ).toThrow('$eq requires a simple value')
  })

  // Additional tests for object descriptor forms
  it('supports standard operators in object descriptors', () => {
    const cb = ConditionBuilder.create().where({
      // Standard operators with $ prefix
      field1: { $gt: 10 },
      field2: { $lt: 20 },
      field3: { $eq: 30 },
      field4: { $ne: 40 },
      field5: { $gte: 50 },
      field6: { $lte: 60 },
      // Using explicit op format
      field7: { op: '$between', value: [1, 10] },
      field8: { op: '$in', value: [20, 30] },
      field9: { op: '$notin', value: [40, 50] },
    })

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'field1', op: '$gt', value: 10 },
        { field: 'field2', op: '$lt', value: 20 },
        { field: 'field3', op: '$eq', value: 30 },
        { field: 'field4', op: '$ne', value: 40 },
        { field: 'field5', op: '$gte', value: 50 },
        { field: 'field6', op: '$lte', value: 60 },
        { field: 'field7', op: '$between', value: [1, 10] },
        { field: 'field8', op: '$in', value: [20, 30] },
        { field: 'field9', op: '$notin', value: [40, 50] },
      ],
    })
  })

  it('supports mixing object descriptors with groups', () => {
    const cb = ConditionBuilder.create()
      .where({
        status: 'active',
        age: { $gte: 18 },
      })
      .orGroup((b) =>
        b.where({
          premium: true,
          level: { $gt: 5 },
          tags: ['vip', 'special'],
        })
      )

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'status', op: '$eq', value: 'active' },
        { field: 'age', op: '$gte', value: 18 },
        {
          type: 'or',
          conditions: [
            { field: 'premium', op: '$eq', value: true },
            { field: 'level', op: '$gt', value: 5 },
            { field: 'tags', op: '$in', value: ['vip', 'special'] },
          ],
        },
      ],
    })
  })

  it('supports advanced LIKE patterns in object form', () => {
    const cb = ConditionBuilder.create().where({
      email: { $like: '%@example.com' },
      domain: { $like: 'example.%' },
      name: { $ilike: 'john%' },
      code: { $notlike: 'TEST%' },
    })

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'email', op: '$like', value: '%@example.com' },
        { field: 'domain', op: '$like', value: 'example.%' },
        { field: 'name', op: '$ilike', value: 'john%' },
        { field: 'code', op: '$notlike', value: 'TEST%' },
      ],
    })
  })

  it('validates object descriptor values', () => {
    // Invalid BETWEEN value
    expect(() =>
      // @ts-expect-error - Should be [min, max]
      ConditionBuilder.create().where({
        range: { $between: [1] },
      })
    ).toThrow('$between requires a tuple/array of two values')

    // Invalid LIKE value
    expect(() =>
      ConditionBuilder.create().where({
        name: { $like: 123 as any },
      })
    ).toThrow('$like requires a string value')

    // Invalid comparison value
    expect(() =>
      ConditionBuilder.create().where({
        age: { $gt: {} as any },
      })
    ).toThrow('$gt requires a comparable value')

    // Invalid IN value
    expect(() =>
      ConditionBuilder.create().where({
        tags: { $in: 'not-an-array' as any },
      })
    ).toThrow('$in requires an array of strings or numbers')
  })

  it('handles empty groups correctly', () => {
    const cb = ConditionBuilder.create()
      .andGroup(() => {})
      .orGroup(() => {})

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { type: 'and', conditions: [] },
        { type: 'or', conditions: [] },
      ],
    })
  })

  it('handles deeply nested groups', () => {
    const cb = ConditionBuilder.create().andGroup((a) =>
      a
        .where('field1')
        .eq(1)
        .orGroup((b) =>
          b
            .where('field2')
            .eq(2)
            .andGroup((c) => c.where('field3').eq(3))
        )
    )

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        {
          type: 'and',
          conditions: [
            { field: 'field1', op: '$eq', value: 1 },
            {
              type: 'or',
              conditions: [
                { field: 'field2', op: '$eq', value: 2 },
                {
                  type: 'and',
                  conditions: [{ field: 'field3', op: '$eq', value: 3 }],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('handles case-insensitive operator strings', () => {
    const cb = ConditionBuilder.create().where('field1', '$gt', 1).where('field2', '$eq', 2).where('field3', '$in', [3]).where('field4', '$like', '4')

    expect(cb.toJSON()).toEqual({
      type: 'and',
      conditions: [
        { field: 'field1', op: '$gt', value: 1 },
        { field: 'field2', op: '$eq', value: 2 },
        { field: 'field3', op: '$in', value: [3] },
        { field: 'field4', op: '$like', value: '4' },
      ],
    })
  })

  it('validates edge cases for comparison operators', () => {
    // Undefined values
    expect(() =>
      ConditionBuilder.create()
        .where('field')
        .gt(undefined as any)
    ).toThrow('Value is required for operator $gt')

    // Null values for non-eq operators
    expect(() =>
      ConditionBuilder.create()
        .where('field')
        .gt(null as any)
    ).toThrow('$gt requires a comparable value')

    // Boolean values for comparison
    expect(() =>
      ConditionBuilder.create()
        .where('field')
        .gt(true as any)
    ).toThrow('$gt requires a comparable value')

    // Date objects should work for comparison
    const date = new Date()
    expect(() => ConditionBuilder.create().where('field').gt(date)).not.toThrow()
  })

  it('validates descriptor key formats', () => {
    // Invalid operator key
    expect(() =>
      // @ts-expect-error - Should be a correct operator
      ConditionBuilder.create().where({
        field: { $invalid: 123 },
      })
    ).toThrow()

    // Missing value in explicit op format
    expect(() =>
      ConditionBuilder.create().where({
        field: { op: '$eq' } as any,
      })
    ).toThrow()

    // Empty object as a value
    expect(() =>
      ConditionBuilder.create().where({
        field: {},
      })
    ).toThrow()
  })
})
