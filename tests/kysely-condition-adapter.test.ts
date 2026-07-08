import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ConditionBuilder, ConditionGroup, KyselyConditionAdapter } from '../src'

interface IUsersTable {
  id: number
  name: string
  age: number
  status: string
}

interface IProductsTable {
  id: number
  category: string
  status: string
  price: number
}

interface ITestDb {
  users: IUsersTable
  products: IProductsTable
  test_users: {
    id: number
    name: string
    age: number
    status: string
  }
  complex_users: {
    id: number
    status: string
    deletedAt: string | null
    isPremium: number
    postCount: number
    registeredAt: string
  }
}

describe('KyselyConditionAdapter', () => {
  let db: Kysely<ITestDb>
  let sqlite: Database.Database
  let adapter: KyselyConditionAdapter

  beforeEach(() => {
    sqlite = new Database(':memory:')
    db = new Kysely<ITestDb>({
      dialect: new SqliteDialect({ database: sqlite }),
    })
    adapter = new KyselyConditionAdapter()
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('converts simple eq condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'name', op: '$eq', value: 'John' }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toContain('where')
    expect(compiled.sql).toMatch(/"name"\s*=\s*\?/)
    expect(compiled.parameters).toEqual(['John'])
  })

  it('converts ne (not equal) condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'status', op: '$ne', value: 'inactive' }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"status"\s*<>\s*\?/)
    expect(compiled.parameters).toEqual(['inactive'])
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
    const compiled = applier(db.selectFrom('users').selectAll() as any).compile()

    expect(compiled.sql).toMatch(/"age"\s*>\s*\?/)
    expect(compiled.sql).toMatch(/"score"\s*>=\s*\?/)
    expect(compiled.sql).toMatch(/"price"\s*<\s*\?/)
    expect(compiled.sql).toMatch(/"rating"\s*<=\s*\?/)
    expect(compiled.parameters).toEqual([18, 50, 100, 5])
  })

  it('converts in and notin operators', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'category', op: '$in', value: ['books', 'electronics'] },
        { field: 'status', op: '$notin', value: ['deleted', 'archived'] },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('products').selectAll()).compile()

    expect(compiled.sql).toMatch(/"category"\s+in\s+\(\?,\s*\?\)/i)
    expect(compiled.sql).toMatch(/"status"\s+not in\s+\(\?,\s*\?\)/i)
    expect(compiled.parameters).toEqual(['books', 'electronics', 'deleted', 'archived'])
  })

  it('converts $nin alias to not in', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'status', op: '$nin', value: ['x', 'y'] }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"status"\s+not in\s+\(\?,\s*\?\)/i)
    expect(compiled.parameters).toEqual(['x', 'y'])
  })

  it('converts like and not like patterns', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'email', op: '$like', value: '%@example.com' },
        { field: 'name', op: '$notlike', value: '%test%' },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll() as any).compile()

    // Pattern operators emit an explicit ESCAPE so escaping works on every dialect
    expect(compiled.sql).toMatch(/"email"\s+like\s+\?\s+escape\s+\?/i)
    expect(compiled.sql).toMatch(/"name"\s+not like\s+\?\s+escape\s+\?/i)
    expect(compiled.parameters).toEqual(['%@example.com', '\\', '%test%', '\\'])
  })

  it('converts ilike pattern (passed through as ilike operator)', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'name', op: '$ilike', value: '%Alice%' }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"name"\s+ilike\s+\?\s+escape\s+\?/i)
    expect(compiled.parameters).toEqual(['%Alice%', '\\'])
  })

  it('converts between operator into >= and <=', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'price', op: '$between', value: [10, 100] }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('products').selectAll()).compile()

    expect(compiled.sql).toMatch(/"price"\s*>=\s*\?/)
    expect(compiled.sql).toMatch(/"price"\s*<=\s*\?/)
    expect(compiled.parameters).toEqual([10, 100])
  })

  it('converts notbetween operator into OR of strict bounds', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'age', op: '$notbetween', value: [18, 65] }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"age"\s*<\s*\?/)
    expect(compiled.sql).toMatch(/"age"\s*>\s*\?/)
    expect(compiled.sql).toMatch(/\bor\b/i)
    expect(compiled.parameters).toEqual([18, 65])
  })

  it('converts null checks', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'deletedAt', op: '$isnull' },
        { field: 'name', op: '$notnull' },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll() as any).compile()

    expect(compiled.sql).toMatch(/"deletedAt"\s+is\s+null/i)
    expect(compiled.sql).toMatch(/"name"\s+is\s+not\s+null/i)
  })

  it('converts OR groups', () => {
    const condition: ConditionGroup = {
      $or: [
        { field: 'status', op: '$eq', value: 'active' },
        { field: 'status', op: '$eq', value: 'pending' },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toContain('where')
    expect(compiled.sql).toMatch(/\bor\b/i)
    expect(compiled.parameters).toEqual(['active', 'pending'])
  })

  it('converts nested AND/OR groups', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'status', op: '$eq', value: 'active' },
        {
          $or: [
            { field: 'name', op: '$eq', value: 'admin' },
            { field: 'name', op: '$eq', value: 'moderator' },
          ],
        },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"status"\s*=\s*\?/)
    expect(compiled.sql).toMatch(/"name"\s*=\s*\?/)
    expect(compiled.sql).toMatch(/\bor\b/i)
    expect(compiled.parameters).toEqual(['active', 'admin', 'moderator'])
  })

  it('converts complex nested conditions', () => {
    const condition: ConditionGroup = {
      $and: [
        { field: 'status', op: '$eq', value: 'active' },
        {
          $or: [
            {
              $and: [
                { field: 'age', op: '$gte', value: 18 },
                { field: 'age', op: '$lt', value: 65 },
              ],
            },
            { field: 'name', op: '$eq', value: 'special' },
          ],
        },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"status"\s*=\s*\?/)
    expect(compiled.sql).toMatch(/"age"\s*>=\s*\?/)
    expect(compiled.sql).toMatch(/"age"\s*<\s*\?/)
    expect(compiled.sql).toMatch(/"name"\s*=\s*\?/)
    expect(compiled.parameters).toEqual(['active', 18, 65, 'special'])
  })

  it('works with ConditionBuilder output', () => {
    const builder = ConditionBuilder.create()
      .where('name')
      .eq('Alice')
      .where('age')
      .gt(25)
      .orGroup((b) => b.where('status').eq('admin').where('status').eq('moderator'))

    const json = builder.build()
    const applier = adapter.serialize(json)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/"name"\s*=\s*\?/)
    expect(compiled.sql).toMatch(/"age"\s*>\s*\?/)
    expect(compiled.sql).toMatch(/"status"\s*=\s*\?/)
    expect(compiled.parameters).toContain('Alice')
    expect(compiled.parameters).toContain(25)
    expect(compiled.parameters).toContain('admin')
    expect(compiled.parameters).toContain('moderator')
  })

  it('handles empty $and groups (no where clause emitted)', () => {
    const condition: ConditionGroup = { $and: [] }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql.toLowerCase()).not.toContain('where')
  })

  it('handles empty $or groups (no where clause emitted)', () => {
    const condition: ConditionGroup = { $or: [] }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql.toLowerCase()).not.toContain('where')
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

    const json = builder.build()
    const applier = adapter.serialize(json)
    const compiled = applier(db.selectFrom('users').selectAll() as any).compile()

    expect(compiled.sql).toMatch(/"name"\s*=\s*\?/)
    expect(compiled.sql).toMatch(/"age"\s*>\s*\?/)
    expect(compiled.sql).toMatch(/"score"\s*<=\s*\?/)
    expect(compiled.sql).toMatch(/"tags"\s+in/i)
    expect(compiled.sql).toMatch(/"range"\s*>=\s*\?/)
    expect(compiled.sql).toMatch(/"range"\s*<=\s*\?/)
    expect(compiled.sql).toMatch(/"maybe"\s+is\s+null/i)
  })

  it('can be used to execute actual queries', async () => {
    await db.schema
      .createTable('test_users')
      .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
      .addColumn('name', 'text')
      .addColumn('age', 'integer')
      .addColumn('status', 'text')
      .execute()

    await db
      .insertInto('test_users')
      .values([
        { name: 'Alice', age: 30, status: 'active' },
        { name: 'Bob', age: 25, status: 'active' },
        { name: 'Charlie', age: 35, status: 'inactive' },
        { name: 'David', age: 28, status: 'pending' },
      ] as any)
      .execute()

    const condition = ConditionBuilder.create().where('status').eq('active').where('age').gte(26).build()

    const applier = adapter.serialize(condition)
    const results = await applier(db.selectFrom('test_users').selectAll()).execute()

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Alice')
    expect(results[0].age).toBe(30)
  })

  it('handles complex real-world query against a real db', async () => {
    await db.schema
      .createTable('complex_users')
      .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
      .addColumn('status', 'text')
      .addColumn('deletedAt', 'text')
      .addColumn('isPremium', 'integer')
      .addColumn('postCount', 'integer')
      .addColumn('registeredAt', 'text')
      .execute()

    await db
      .insertInto('complex_users')
      .values([
        { status: 'active', deletedAt: null, isPremium: 1, postCount: 50, registeredAt: '2024-06-01' },
        { status: 'active', deletedAt: null, isPremium: 0, postCount: 150, registeredAt: '2024-03-15' },
        { status: 'inactive', deletedAt: null, isPremium: 0, postCount: 10, registeredAt: '2024-01-01' },
      ] as any)
      .execute()

    // Active users who are either premium (1) or have > 100 posts
    const condition = ConditionBuilder.create()
      .where('status')
      .eq('active')
      .where('deletedAt')
      .isNull()
      .orGroup((b) => b.where('isPremium').eq(1).where('postCount').gt(100))
      .build()

    const applier = adapter.serialize(condition)
    const results = await applier(db.selectFrom('complex_users').selectAll()).execute()

    expect(results).toHaveLength(2)
  })

  it('generates correct SQL for single condition', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'id', op: '$eq', value: 1 }],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('users').selectAll()).compile()

    expect(compiled.sql).toMatch(/select\s+.*\s+from\s+"users"\s+where\s+"id"\s*=\s*\?/i)
    expect(compiled.parameters).toEqual([1])
  })

  it('handles $nin in OR groups', () => {
    const condition: ConditionGroup = {
      $or: [
        { field: 'status', op: '$eq', value: 'active' },
        { field: 'category', op: '$nin', value: ['archived', 'deleted'] },
      ],
    }

    const applier = adapter.serialize(condition)
    const compiled = applier(db.selectFrom('products').selectAll()).compile()

    expect(compiled.sql).toMatch(/"status"\s*=\s*\?/)
    expect(compiled.sql).toMatch(/"category"\s+not in\s+\(\?,\s*\?\)/i)
    expect(compiled.sql).toMatch(/\bor\b/i)
    expect(compiled.parameters).toEqual(['active', 'archived', 'deleted'])
  })

  it('handles field name mapping', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'userName', op: '$eq', value: 'Alice' }],
    }

    const applier = adapter.serialize(condition, { fieldMapping: { userName: 'user_name' } })
    const compiled = applier(db.selectFrom('users').selectAll() as any).compile()

    expect(compiled.sql).toMatch(/"user_name"\s*=\s*\?/)
    expect(compiled.parameters).toEqual(['Alice'])
  })

  it('throws on unsupported operator', () => {
    const condition: ConditionGroup = {
      $and: [{ field: 'name', op: '$bogus' as any, value: 'x' } as any],
    }

    const applier = adapter.serialize(condition)
    expect(() => applier(db.selectFrom('users').selectAll())).toThrow(/Unsupported operator/)
  })
})
