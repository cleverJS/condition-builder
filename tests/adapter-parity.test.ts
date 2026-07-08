import Database from 'better-sqlite3'
import knex, { Knex } from 'knex'
import { Kysely, SqliteDialect } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Condition, escapeLikeValue, KendoFilterAdapter, KnexConditionAdapter, KyselyConditionAdapter, MikroOrmConditionAdapter } from '../src'

/**
 * Cross-adapter parity suite.
 *
 * The library's core promise is "build a condition once, run it on any ORM".
 * These tests execute the SAME Condition through Knex and Kysely against
 * identical live better-sqlite3 datasets and assert both return the SAME rows.
 * The bug class: per-adapter tests encode per-adapter expectations, so a
 * semantic divergence ($eq null, empty groups, empty $in) passes everywhere
 * while the adapters disagree in production.
 *
 * $ilike/$notilike are excluded from execution: they compile to the ILIKE
 * keyword in Kysely, which requires a PostgreSQL-family dialect.
 */

interface IUsersTable {
  id: number
  name: string
  email: string | null
  age: number
  status: string
  deleted_at: string | null
  note: string
}

interface ITestDb {
  users: IUsersTable
}

const ROWS: IUsersTable[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 30, status: 'active', deleted_at: null, note: '100% cotton' },
  { id: 2, name: 'BOB', email: 'bob@example.com', age: 25, status: 'inactive', deleted_at: '2024-01-01', note: '100x cotton' },
  { id: 3, name: 'carol', email: 'carol@example.com', age: 35, status: 'active', deleted_at: null, note: 'a_b' },
  { id: 4, name: 'Dave', email: 'dave@other.org', age: 40, status: 'banned', deleted_at: '2024-02-02', note: 'axb' },
  { id: 5, name: 'eve', email: null, age: 20, status: 'active', deleted_at: null, note: 'plain' },
]

const ALL_IDS = [1, 2, 3, 4, 5]

describe('Adapter parity: Knex vs Kysely on identical live data', () => {
  let knexDb: Knex
  let kyselyDb: Kysely<ITestDb>
  const knexAdapter = new KnexConditionAdapter()
  const kyselyAdapter = new KyselyConditionAdapter()

  beforeAll(async () => {
    knexDb = knex({ client: 'better-sqlite3', connection: ':memory:', useNullAsDefault: true })
    await knexDb.schema.createTable('users', (table) => {
      table.integer('id').primary()
      table.text('name')
      table.text('email')
      table.integer('age')
      table.text('status')
      table.text('deleted_at')
      table.text('note')
    })
    await knexDb('users').insert(ROWS)

    const sqlite = new Database(':memory:')
    sqlite.exec('CREATE TABLE users (id integer primary key, name text, email text, age integer, status text, deleted_at text, note text)')
    const insert = sqlite.prepare(
      'INSERT INTO users (id, name, email, age, status, deleted_at, note) VALUES (@id, @name, @email, @age, @status, @deleted_at, @note)'
    )
    for (const row of ROWS) {
      insert.run(row)
    }
    kyselyDb = new Kysely<ITestDb>({ dialect: new SqliteDialect({ database: sqlite }) })
  })

  afterAll(async () => {
    await knexDb.destroy()
    await kyselyDb.destroy()
  })

  async function idsViaKnex(condition: Condition): Promise<number[]> {
    const applier = knexAdapter.serialize(condition)
    const rows = (await applier(knexDb('users').select('id'))) as Array<{ id: number }>
    return rows.map((row) => row.id).sort((a, b) => a - b)
  }

  async function idsViaKysely(condition: Condition): Promise<number[]> {
    const applier = kyselyAdapter.serialize(condition)
    const rows = await applier(kyselyDb.selectFrom('users').select('id')).execute()
    return rows.map((row) => row.id).sort((a, b) => a - b)
  }

  const CASES: Array<{ name: string; condition: Condition; expected: number[] }> = [
    { name: '$eq matches exact value', condition: { field: 'status', op: '$eq', value: 'active' }, expected: [1, 3, 5] },
    { name: '$eq null behaves as IS NULL', condition: { field: 'deleted_at', op: '$eq', value: null }, expected: [1, 3, 5] },
    { name: '$ne null behaves as IS NOT NULL', condition: { field: 'deleted_at', op: '$ne', value: null }, expected: [2, 4] },
    { name: '$ne excludes matching rows', condition: { field: 'status', op: '$ne', value: 'active' }, expected: [2, 4] },
    { name: '$gt is exclusive', condition: { field: 'age', op: '$gt', value: 30 }, expected: [3, 4] },
    { name: '$lte is inclusive', condition: { field: 'age', op: '$lte', value: 25 }, expected: [2, 5] },
    { name: '$in matches listed values', condition: { field: 'status', op: '$in', value: ['active', 'banned'] }, expected: [1, 3, 4, 5] },
    { name: 'empty $in matches nothing', condition: { field: 'status', op: '$in', value: [] }, expected: [] },
    { name: 'empty $notin matches everything', condition: { field: 'status', op: '$notin', value: [] }, expected: ALL_IDS },
    { name: '$between is inclusive on both bounds', condition: { field: 'age', op: '$between', value: [25, 35] }, expected: [1, 2, 3] },
    { name: '$notbetween excludes the inclusive range', condition: { field: 'age', op: '$notbetween', value: [25, 35] }, expected: [4, 5] },
    { name: '$isnull matches null column', condition: { field: 'email', op: '$isnull' }, expected: [5] },
    { name: '$notnull matches non-null column', condition: { field: 'email', op: '$notnull' }, expected: [1, 2, 3, 4] },
    {
      name: 'nested empty $or group is a no-op, sibling condition still applies',
      condition: { $and: [{ field: 'status', op: '$eq', value: 'active' }, { $or: [] }] },
      expected: [1, 3, 5],
    },
    {
      name: 'nested and/or tree',
      condition: {
        $and: [
          { field: 'status', op: '$eq', value: 'active' },
          {
            $or: [
              { field: 'age', op: '$lt', value: 25 },
              { field: 'name', op: '$like', value: 'car%' },
            ],
          },
        ],
      },
      expected: [3, 5],
    },
    {
      name: 'escaped % in $like matches the literal percent character',
      condition: { field: 'note', op: '$like', value: `%${escapeLikeValue('100%')}%` },
      expected: [1],
    },
    {
      name: 'escaped _ in $like matches the literal underscore character',
      condition: { field: 'note', op: '$like', value: escapeLikeValue('a_b') },
      expected: [3],
    },
    {
      name: '$notlike with escaped wildcard excludes only the literal match',
      condition: { field: 'note', op: '$notlike', value: `%${escapeLikeValue('100%')}%` },
      expected: [2, 3, 4, 5],
    },
  ]

  for (const { name, condition, expected } of CASES) {
    it(`should return identical rows in Knex and Kysely: ${name}`, async () => {
      await expect(idsViaKnex(condition)).resolves.toEqual(expected)
      await expect(idsViaKysely(condition)).resolves.toEqual(expected)
    })
  }

  it('should filter by the literal % end-to-end through the Kendo adapter (Knex)', async () => {
    // Regression: escapeLikeValue produced backslash escapes but no ESCAPE
    // clause was emitted, so this returned [] on SQLite
    const kendo = new KendoFilterAdapter()
    const condition = kendo.deserialize({ field: 'note', operator: 'contains', value: '100%' }).build()
    await expect(idsViaKnex(condition)).resolves.toEqual([1])
  })

  it('should not lose the WHERE clause for hostile field names when fieldMapping is set', async () => {
    // Regression: mapFieldName('constructor') resolved through the prototype
    // chain to the Object constructor and Knex silently dropped the condition
    const applier = knexAdapter.serialize({ field: 'constructor', op: '$eq', value: 'x' }, { fieldMapping: { name: 'user_name' } })
    const compiled = applier(knexDb('users')).toSQL()
    expect(compiled.sql).toMatch(/where\s+`constructor`\s*=\s*\?/i)
    expect(compiled.bindings).toEqual(['x'])
  })
})

describe('Adapter parity: MikroORM serialization shapes', () => {
  const mikro = new MikroOrmConditionAdapter()

  it('should serialize $eq null with IS NULL semantics like the other adapters', () => {
    expect(mikro.serialize({ field: 'deletedAt', op: '$eq', value: null })).toEqual({ deletedAt: null })
  })

  it('should prune nested empty groups like the other adapters', () => {
    const condition: Condition = { $and: [{ field: 'a', op: '$eq', value: 1 }, { $or: [] }] }
    expect(mikro.serialize(condition)).toEqual({ a: 1 })
  })

  it('should serialize a fully empty condition to match-all', () => {
    expect(mikro.serialize({ $and: [] })).toEqual({})
  })

  it('should serialize $notilike as a negated $ilike', () => {
    expect(mikro.serialize({ field: 'name', op: '$notilike', value: '%x%' })).toEqual({ name: { $not: { $ilike: '%x%' } } })
  })
})
