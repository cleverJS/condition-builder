import { raw } from '@mikro-orm/core'
import { describe, expect, it } from 'vitest'

import { ConditionBuilder, MikroOrmConditionAdapter } from '../src'

describe('MikroOrmConditionAdapter with RawCondition', () => {
  it('should convert raw condition without bindings', () => {
    const cb = ConditionBuilder.create().raw('created_at > NOW() - INTERVAL 7 DAY')
    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    // MikroORM uses raw() helper which returns a RawQueryFragment
    expect(result).toEqual(raw('created_at > NOW() - INTERVAL 7 DAY'))
  })

  it('should convert raw condition with bindings', () => {
    const cb = ConditionBuilder.create().raw("data->>'status' = ?", ['active'])
    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    expect(result).toEqual(raw("data->>'status' = ?", ['active']))
  })

  it('should convert raw condition with PostgreSQL array syntax', () => {
    const roles = ['admin', 'user']
    const cb = ConditionBuilder.create().raw('roles @> ARRAY[?]::varchar[]', [roles])
    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    expect(result).toEqual(raw('roles @> ARRAY[?]::varchar[]', [['admin', 'user']]))
  })

  it('should combine raw condition with regular conditions using AND', () => {
    const cb = ConditionBuilder.create().where('age').gt(18).raw("data->>'status' = ?", ['active']).where('name').like('%John%')

    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    expect(result).toEqual({
      $and: [{ age: { $gt: 18 } }, raw("data->>'status' = ?", ['active']), { name: { $like: '%John%' } }],
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

    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    expect(result).toEqual({
      $and: [
        { age: { $gt: 18 } },
        {
          $or: [{ status: 'active' }, raw('roles @> ARRAY[?]::varchar[]', [['admin']])],
        },
      ],
    })
  })

  it('should handle multiple raw conditions', () => {
    const cb = ConditionBuilder.create().raw('date_part(?, created_at) = ?', ['year', 2024]).raw('date_part(?, created_at) = ?', ['month', 1])

    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    expect(result).toEqual({
      $and: [raw('date_part(?, created_at) = ?', ['year', 2024]), raw('date_part(?, created_at) = ?', ['month', 1])],
    })
  })

  it('should handle complex JSON conditions with raw SQL', () => {
    const cb = ConditionBuilder.create()
      .where('id')
      .gt(100)
      .raw('data @> ?::jsonb', [JSON.stringify({ active: true })])
      .where('type')
      .in(['user', 'admin'])

    const adapter = new MikroOrmConditionAdapter()
    const result = adapter.serialize(cb.build())

    expect(result).toEqual({
      $and: [{ id: { $gt: 100 } }, raw('data @> ?::jsonb', ['{"active":true}']), { type: { $in: ['user', 'admin'] } }],
    })
  })
})
