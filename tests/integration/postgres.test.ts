import { BaseEntity, Entity, EntityManager, EntityRepository, FilterQuery, MikroORM, raw as mikroRaw, Property } from '@mikro-orm/core'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AdapterType, Condition, ConditionAdapterRegistry, ConditionBuilder, KnexConditionAdapter, MikroOrmConditionAdapter } from '../../src'

describe.skip('MikroRepository', () => {
  let orm: MikroORM
  let em: EntityManager
  let repository: EntityRepository<UserEntity>

  beforeAll(async () => {
    const conditionAdapterRegistry = ConditionAdapterRegistry.getInstance()
    conditionAdapterRegistry.register(AdapterType.KNEX, new KnexConditionAdapter())
    conditionAdapterRegistry.register(AdapterType.MIKROORM, new MikroOrmConditionAdapter())

    // Initialize MikroORM with PostgreSQL
    orm = await MikroORM.init({
      entities: [UserEntity],
      driver: PostgreSqlDriver,
      dbName: process.env.POSTGRES_DB || 'test_db',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'test_db',
      password: process.env.POSTGRES_PASSWORD || 'test_db',
      debug: true,
    })

    em = orm.em.fork()

    // Create the test table
    await orm.schema.dropSchema()
    await orm.schema.createSchema()

    // Initialize repository
    repository = em.getRepository(UserEntity)
  })

  afterAll(async () => {
    // Clean up: drop schema and close connection
    await orm.schema.dropSchema()
    await orm.close(true)
  })

  describe('Check raw', () => {
    beforeEach(async () => {
      // Clear and re-insert test data before each test
      await repository.nativeDelete({})
      const userData: Omit<User, 'id'>[] = [
        { email: 'bob@example.com', name: 'Bob', age: 25, isActive: true, createdAt: new Date(), roles: ['admin'] },
        { email: 'eve@example.com', name: 'eve', age: 30, isActive: true, createdAt: new Date(), roles: ['user'] },
        { email: 'keep@example.com', name: 'Keep', age: 35, isActive: false, createdAt: new Date(), roles: ['admin', 'manager'] },
      ]

      await repository.insertMany(userData)
    })

    it('should filter users by full raw condition', async () => {
      const users = await repository.findAll({
        where: mikroRaw(`roles @> '["admin"]'::jsonb`) as unknown as FilterQuery<UserEntity>,
      })

      expect(users).toHaveLength(2)
      expect(users.map((u) => u.name).sort()).toEqual(['Bob', 'Keep'])
    })

    it('should filter users by condition builder', async () => {
      const condition: Condition = ConditionBuilder.create({
        name: 'Bob',
      }).build()
      const users = await repository.findAll({ where: serializeCondition<UserEntity>(condition) })

      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('Bob')
    })
  })

  function serializeCondition<T>(condition?: Condition): FilterQuery<T> {
    if (!condition) {
      return {} as FilterQuery<T>
    }

    const serializer = ConditionAdapterRegistry.getInstance().getSerializer<FilterQuery<T>>(AdapterType.MIKROORM)
    return serializer.serialize(condition)
  }
})

@Entity({ tableName: 'test_users' })
class UserEntity extends BaseEntity {
  @Property({ primary: true })
  email: string = ''

  @Property()
  name: string = ''

  @Property()
  age: number = 0

  @Property({ fieldName: 'is_active', default: true })
  isActive: boolean = true

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date()

  @Property({ nullable: true })
  bio?: string

  @Property({ type: 'jsonb' })
  roles: string[] = []
}

interface User {
  email: string
  name: string
  age: number
  isActive: boolean
  createdAt: Date
  bio?: string
  roles: string[]
}
