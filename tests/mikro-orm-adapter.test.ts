import { describe, expect, it } from 'vitest'

import { ConditionBuilder, ConditionGroup, MikroOrmConditionAdapter } from '../src'

describe('MikroOrmAdapter', () => {
  const adapter = new MikroOrmConditionAdapter()

  it('converts simple eq condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'name', op: '$eq', value: 'John' }],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({ name: 'John' })
  })

  it('converts ne (not equal) condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'status', op: '$ne', value: 'inactive' }],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({ status: { $ne: 'inactive' } })
  })

  it('converts comparison operators (gt, gte, lt, lte)', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'age', op: '$gt', value: 18 },
        { field: 'score', op: '$gte', value: 50 },
        { field: 'price', op: '$lt', value: 100 },
        { field: 'rating', op: '$lte', value: 5 },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $and: [{ age: { $gt: 18 } }, { score: { $gte: 50 } }, { price: { $lt: 100 } }, { rating: { $lte: 5 } }],
    })
  })

  it('converts in and notin operators', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'category', op: '$in', value: ['books', 'electronics'] },
        { field: 'status', op: '$notin', value: ['deleted', 'archived'] },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $and: [{ category: { $in: ['books', 'electronics'] } }, { status: { $nin: ['deleted', 'archived'] } }],
    })
  })

  it('converts like patterns', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'email', op: '$like', value: '%@example.com' },
        { field: 'name', op: '$ilike', value: '%john%' },
        { field: 'title', op: '$notlike', value: '%test%' },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $and: [{ email: { $like: '%@example.com' } }, { name: { $ilike: '%john%' } }, { title: { $not: { $like: '%test%' } } }],
    })
  })

  it('converts between operator to gte/lte', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'price', op: '$between', value: [10, 100] }],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({ price: { $gte: 10, $lte: 100 } })
  })

  it('converts notbetween operator to or with lt/gt', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'age', op: '$notbetween', value: [18, 65] }],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $or: [{ age: { $lt: 18 } }, { age: { $gt: 65 } }],
    })
  })

  it('converts null checks', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'deletedAt', op: '$isnull' },
        { field: 'email', op: '$notnull' },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $and: [{ deletedAt: null }, { email: { $ne: null } }],
    })
  })

  it('converts OR groups', () => {
    const condition: ConditionGroup = {
      $or: [
        { field: 'status', op: '$eq', value: 'active' },
        { field: 'status', op: '$eq', value: 'pending' },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $or: [{ status: 'active' }, { status: 'pending' }],
    })
  })

  it('converts nested AND/OR groups', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'type', op: '$eq', value: 'user' },
        {
          $or: [
            { field: 'role', op: '$eq', value: 'admin' },
            { field: 'role', op: '$eq', value: 'moderator' },
          ],
        },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $and: [
        { type: 'user' },
        {
          $or: [{ role: 'admin' }, { role: 'moderator' }],
        },
      ],
    })
  })

  it('converts complex nested conditions', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'isActive', op: '$eq', value: true },
        {
          $or: [
            {
              $and: [
                { field: 'age', op: '$gte', value: 18 },
                { field: 'age', op: '$lt', value: 65 },
              ],
            },
            { field: 'hasPermission', op: '$eq', value: true },
          ],
        },
      ],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      $and: [
        { isActive: true },
        {
          $or: [
            {
              $and: [{ age: { $gte: 18 } }, { age: { $lt: 65 } }],
            },
            { hasPermission: true },
          ],
        },
      ],
    })
  })

  it('works with ConditionBuilder output', () => {
    const builder = ConditionBuilder.create()
      .where('name')
      .eq('Alice')
      .where('age')
      .gt(25)
      .orGroup((b) => b.where('role').eq('admin').where('role').eq('moderator'))

    const json = builder.build()
    const result = adapter.serialize(json)

    expect(result).toEqual({
      $and: [
        { name: 'Alice' },
        { age: { $gt: 25 } },
        {
          $or: [{ role: 'admin' }, { role: 'moderator' }],
        },
      ],
    })
  })

  it('handles single condition groups by unwrapping', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'id', op: '$eq', value: 1 }],
    }

    const result = adapter.serialize(condition)
    // Single condition in AND group should be unwrapped
    expect(result).toEqual({ id: 1 })
  })

  it('converts all operator types from ConditionBuilder', () => {
    const builder = ConditionBuilder.create()
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

    const json = builder.build()
    const result = adapter.serialize(json)

    expect(result).toEqual({
      $and: [
        { name: 'alice' },
        { age: { $gt: 18 } },
        { score: { $lte: 100 } },
        { email: { $ilike: '%@example.com' } },
        { tags: { $in: ['a', 'b'] } },
        { range: { $gte: 1, $lte: 10 } },
        { maybe: null },
      ],
    })
  })

  it('handles date values in between conditions', () => {
    const startDate = new Date('2023-01-01')
    const endDate = new Date('2023-12-31')

    const condition: ConditionGroup = {
      $and: [{ field: 'createdAt', op: '$between', value: [startDate, endDate] }],
    }

    const result = adapter.serialize(condition)
    expect(result).toEqual({
      createdAt: { $gte: startDate, $lte: endDate },
    })
  })

  it('converts complex real-world query', () => {
    // Find active users who are either premium or have more than 100 posts
    // and registered this year
    const builder = ConditionBuilder.create()
      .where('status')
      .eq('active')
      .where('deletedAt')
      .isNull()
      .orGroup((b) => b.where('isPremium').eq(true).where('postCount').gt(100))
      .where('registeredAt')
      .between(new Date('2024-01-01'), new Date('2024-12-31'))

    const json = builder.build()
    const result = adapter.serialize(json)

    expect(result).toEqual({
      $and: [
        { status: 'active' },
        { deletedAt: null },
        {
          $or: [{ isPremium: true }, { postCount: { $gt: 100 } }],
        },
        {
          registeredAt: {
            $gte: new Date('2024-01-01'),
            $lte: new Date('2024-12-31'),
          },
        },
      ],
    })
  })
})
