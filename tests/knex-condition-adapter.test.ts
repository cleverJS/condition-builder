import knex, { Knex } from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ConditionBuilder, ConditionGroup, KnexConditionAdapter } from '../src'

describe('KnexConditionAdapter', () => {
  let db: Knex
  let adapter: KnexConditionAdapter

  beforeEach(() => {
    // Create an in-memory SQLite database for testing
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

  it('converts simple eq condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'name', op: '$eq', value: 'John' }],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))

    expect(query.toSQL().sql).toContain('where')
    expect(query.toSQL().sql).toMatch(/`name`\s*=\s*\?/)
    expect(query.toSQL().bindings).toEqual(['John'])
  })

  it('converts ne (not equal) condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'status', op: '$ne', value: 'inactive' }],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))

    expect(query.toSQL().sql).toMatch(/`status`\s*<>\s*\?/)
    expect(query.toSQL().bindings).toEqual(['inactive'])
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

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`age`\s*>\s*\?/)
    expect(sql.sql).toMatch(/`score`\s*>=\s*\?/)
    expect(sql.sql).toMatch(/`price`\s*<\s*\?/)
    expect(sql.sql).toMatch(/`rating`\s*<=\s*\?/)
    expect(sql.bindings).toEqual([18, 50, 100, 5])
  })

  it('converts in and notin operators', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'category', op: '$in', value: ['books', 'electronics'] },
        { field: 'status', op: '$notin', value: ['deleted', 'archived'] },
      ],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('products'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`category`\s+in\s+\(\?, \?\)/i)
    expect(sql.sql).toMatch(/`status`\s+not in\s+\(\?, \?\)/i)
    expect(sql.bindings).toEqual(['books', 'electronics', 'deleted', 'archived'])
  })

  it('converts like patterns', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'email', op: '$like', value: '%@example.com' },
        { field: 'title', op: '$notlike', value: '%test%' },
      ],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`email`\s+like\s+\?/i)
    expect(sql.sql).toMatch(/not\s+`title`\s+like\s+\?/i)
    expect(sql.bindings).toEqual(['%@example.com', '%test%'])
  })

  it('converts between operator', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'price', op: '$between', value: [10, 100] }],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('products'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`price`\s+between\s+\?\s+and\s+\?/i)
    expect(sql.bindings).toEqual([10, 100])
  })

  it('converts notbetween operator', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'age', op: '$notbetween', value: [18, 65] }],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`age`\s+not between\s+\?\s+and\s+\?/i)
    expect(sql.bindings).toEqual([18, 65])
  })

  it('converts null checks', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'deletedAt', op: '$isnull' },
        { field: 'email', op: '$notnull' },
      ],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`deletedAt`\s+is null/i)
    expect(sql.sql).toMatch(/`email`\s+is not null/i)
  })

  it('converts OR groups', () => {
    const condition: ConditionGroup = {
      $or: [
        { field: 'status', op: '$eq', value: 'active' },
        { field: 'status', op: '$eq', value: 'pending' },
      ],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toContain('where')
    expect(sql.sql).toMatch(/`status`\s*=\s*\?/)
    expect(sql.sql).toMatch(/or\s+`status`\s*=\s*\?/i)
    expect(sql.bindings).toEqual(['active', 'pending'])
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

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`type`\s*=\s*\?/)
    expect(sql.sql).toMatch(/`role`\s*=\s*\?/)
    expect(sql.sql).toMatch(/or\s+`role`\s*=\s*\?/i)
    expect(sql.bindings).toEqual(['user', 'admin', 'moderator'])
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

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`isActive`\s*=\s*\?/)
    expect(sql.sql).toMatch(/`age`\s*>=\s*\?/)
    expect(sql.sql).toMatch(/`age`\s*<\s*\?/)
    expect(sql.sql).toMatch(/`hasPermission`\s*=\s*\?/)
    expect(sql.bindings).toEqual([true, 18, 65, true])
  })

  it('works with ConditionBuilder output', () => {
    const builder = ConditionBuilder.create()
      .where('name')
      .eq('Alice')
      .where('age')
      .gt(25)
      .orGroup((b) => b.where('role').eq('admin').where('role').eq('moderator'))

    const json = builder.toJSON()
    const applier = adapter.serialize(json)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`name`\s*=\s*\?/)
    expect(sql.sql).toMatch(/`age`\s*>\s*\?/)
    expect(sql.sql).toMatch(/`role`\s*=\s*\?/)
    expect(sql.bindings).toContain('Alice')
    expect(sql.bindings).toContain(25)
    expect(sql.bindings).toContain('admin')
    expect(sql.bindings).toContain('moderator')
  })

  it('handles empty groups', () => {
    const condition: ConditionGroup = {
      $and: [],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))
    const sql = query.toSQL()

    // Should not add any conditions
    expect(sql.sql).not.toContain('where')
  })

  it('converts all operator types from ConditionBuilder', () => {
    const builder = ConditionBuilder.create()
      .where('name')
      .eq('alice')
      .where('age')
      .gt(18)
      .where('score')
      .lte(100)
      .where('tags')
      .in(['a', 'b'])
      .where('range')
      .between(1, 10)
      .where('maybe')
      .isNull()

    const json = builder.toJSON()
    const applier = adapter.serialize(json)
    const query = applier(db('users'))
    const sql = query.toSQL()

    expect(sql.sql).toMatch(/`name`\s*=\s*\?/)
    expect(sql.sql).toMatch(/`age`\s*>\s*\?/)
    expect(sql.sql).toMatch(/`score`\s*<=\s*\?/)
    expect(sql.sql).toMatch(/`tags`\s+in/i)
    expect(sql.sql).toMatch(/`range`\s+between/i)
    expect(sql.sql).toMatch(/`maybe`\s+is null/i)
  })

  it.skip('can be used to execute actual queries', async () => {
    // Skipped: requires building better-sqlite3 native bindings
    // Create a test table
    await db.schema.createTable('test_users', (table) => {
      table.increments('id')
      table.string('name')
      table.integer('age')
      table.string('status')
    })

    // Insert test data
    await db('test_users').insert([
      { name: 'Alice', age: 30, status: 'active' },
      { name: 'Bob', age: 25, status: 'active' },
      { name: 'Charlie', age: 35, status: 'inactive' },
      { name: 'David', age: 28, status: 'pending' },
    ])

    // Build a condition
    const condition = ConditionBuilder.create().where('status').eq('active').where('age').gte(26).toJSON()

    // Apply to query and execute
    const applier = adapter.serialize(condition)
    const results = await applier(db('test_users'))

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Alice')
    expect(results[0].age).toBe(30)
  })

  it.skip('handles complex real-world query', async () => {
    // Skipped: requires building better-sqlite3 native bindings
    // Create test table
    await db.schema.createTable('users', (table) => {
      table.increments('id')
      table.string('status')
      table.timestamp('deletedAt').nullable()
      table.boolean('isPremium')
      table.integer('postCount')
      table.timestamp('registeredAt')
    })

    // Insert test data
    await db('users').insert([
      {
        status: 'active',
        deletedAt: null,
        isPremium: true,
        postCount: 50,
        registeredAt: new Date('2024-06-01'),
      },
      {
        status: 'active',
        deletedAt: null,
        isPremium: false,
        postCount: 150,
        registeredAt: new Date('2024-03-15'),
      },
      {
        status: 'inactive',
        deletedAt: null,
        isPremium: false,
        postCount: 10,
        registeredAt: new Date('2024-01-01'),
      },
    ])

    // Complex query: active users who are either premium or have > 100 posts
    const condition = ConditionBuilder.create()
      .where('status')
      .eq('active')
      .where('deletedAt')
      .isNull()
      .orGroup((b) => b.where('isPremium').eq(true).where('postCount').gt(100))
      .toJSON()

    const applier = adapter.serialize(condition)
    const results = await applier(db('users'))

    expect(results).toHaveLength(2)
  })

  it('generates correct SQL for single condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'id', op: '$eq', value: 1 }],
    }

    const applier = adapter.serialize(condition)
    const query = applier(db('users'))

    expect(query.toSQL().sql).toBe('select * from `users` where `id` = ?')
    expect(query.toSQL().bindings).toEqual([1])
  })
})
