import knex, { Knex } from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ConditionBuilder, KnexConditionAdapter } from '../src'

describe('KnexConditionAdapter with RawCondition', () => {
  let db: Knex
  let adapter: KnexConditionAdapter

  beforeEach(() => {
    db = knex({
      client: 'better-sqlite3',
      connection: ':memory:',
      useNullAsDefault: true,
    })
    adapter = new KnexConditionAdapter()
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('should apply raw condition without bindings', () => {
    const cb = ConditionBuilder.create().raw('1 = 1')
    const applier = adapter.serialize(cb.build())

    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('where 1 = 1')
  })

  it('should apply raw condition with bindings', () => {
    const cb = ConditionBuilder.create().raw('status = ?', ['active'])
    const applier = adapter.serialize(cb.build())

    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('where status = ?')
    expect(sql.bindings).toContain('active')
  })

  it('should combine raw condition with regular conditions', () => {
    const cb = ConditionBuilder.create().where('age').gt(18).raw('status = ?', ['active']).where('name').like('%John%')

    const applier = adapter.serialize(cb.build())
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('age')
    expect(sql.sql).toContain('>')
    expect(sql.sql).toContain('status = ?')
    expect(sql.sql).toContain('name')
    expect(sql.sql).toContain('like')
    expect(sql.bindings).toContain(18)
    expect(sql.bindings).toContain('active')
    expect(sql.bindings).toContain('%John%')
  })

  it('should handle raw condition in OR group', () => {
    const cb = ConditionBuilder.create()
      .where('age')
      .gt(18)
      .orGroup((b) => b.where('status').eq('active').raw('type = ?', ['premium']))

    const applier = adapter.serialize(cb.build())
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('age')
    expect(sql.sql).toContain('type = ?')
    expect(sql.bindings).toContain('premium')
  })

  it('should handle multiple raw conditions', () => {
    const cb = ConditionBuilder.create().raw('year = ?', [2024]).raw('month = ?', [1])

    const applier = adapter.serialize(cb.build())
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('year = ?')
    expect(sql.sql).toContain('month = ?')
    expect(sql.bindings).toContain(2024)
    expect(sql.bindings).toContain(1)
  })

  it('should handle complex raw SQL expressions', () => {
    const cb = ConditionBuilder.create().where('id').gt(100).raw('LENGTH(name) > ?', [5])

    const applier = adapter.serialize(cb.build())
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('id')
    expect(sql.sql).toContain('LENGTH(name) > ?')
    expect(sql.bindings).toContain(100)
    expect(sql.bindings).toContain(5)
  })
})
