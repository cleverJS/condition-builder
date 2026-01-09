import { describe, expect, it } from 'vitest'

import { ConditionBuilder, RawCondition } from '../src'

describe('RawCondition', () => {
  it('should create a raw condition without bindings', () => {
    const cb = ConditionBuilder.create().raw('created_at > NOW() - INTERVAL 7 DAY')

    const result = cb.build() as RawCondition
    expect(result).toEqual({
      $raw: 'created_at > NOW() - INTERVAL 7 DAY',
    })
  })

  it('should create a raw condition with bindings', () => {
    const cb = ConditionBuilder.create().raw("data->>'status' = ?", ['active'])

    const result = cb.build() as RawCondition
    expect(result).toEqual({
      $raw: "data->>'status' = ?",
      bindings: ['active'],
    })
  })

  it('should create a raw condition with array bindings for PostgreSQL', () => {
    const roles = ['admin', 'user']
    const cb = ConditionBuilder.create().raw('roles @> ARRAY[?]::varchar[]', [roles])

    const result = cb.build() as RawCondition
    expect(result).toEqual({
      $raw: 'roles @> ARRAY[?]::varchar[]',
      bindings: [['admin', 'user']],
    })
  })

  it('should combine raw condition with regular conditions using AND', () => {
    const cb = ConditionBuilder.create().where('age').gt(18).raw("data->>'status' = ?", ['active']).where('name').like('%John%')

    const result = cb.build()
    expect(result).toEqual({
      $and: [
        { field: 'age', op: '$gt', value: 18 },
        { $raw: "data->>'status' = ?", bindings: ['active'] },
        { field: 'name', op: '$like', value: '%John%' },
      ],
    })
  })

  it('should combine raw condition with OR groups', () => {
    const cb = ConditionBuilder.create()
      .where('age')
      .gt(18)
      .orGroup((b) =>
        b
          .where('status')
          .eq('active')
          .raw('roles @> ARRAY[?]::varchar[]', [['admin']])
      )

    const result = cb.build()
    expect(result).toEqual({
      $and: [
        { field: 'age', op: '$gt', value: 18 },
        {
          $or: [
            { field: 'status', op: '$eq', value: 'active' },
            { $raw: 'roles @> ARRAY[?]::varchar[]', bindings: [['admin']] },
          ],
        },
      ],
    })
  })

  it('should handle multiple raw conditions', () => {
    const cb = ConditionBuilder.create().raw('date_part(?, created_at) = ?', ['year', 2024]).raw('date_part(?, created_at) = ?', ['month', 1])

    const result = cb.build()
    expect(result).toEqual({
      $and: [
        { $raw: 'date_part(?, created_at) = ?', bindings: ['year', 2024] },
        { $raw: 'date_part(?, created_at) = ?', bindings: ['month', 1] },
      ],
    })
  })

  it('should create a single raw condition without wrapping', () => {
    const cb = ConditionBuilder.create().raw('MATCH(title, content) AGAINST(?)', ['search term'])

    const result = cb.build()
    expect(result).toEqual({
      $raw: 'MATCH(title, content) AGAINST(?)',
      bindings: ['search term'],
    })
  })
})
