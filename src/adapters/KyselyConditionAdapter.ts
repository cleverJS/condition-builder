import type { Expression, ExpressionBuilder, sql as kyselySql, SqlBool } from 'kysely'

import { Condition, ConditionGroup, ConditionItem } from '../builder'
import { isConditionGroup, mapFieldName, PATTERN_OPS, pruneEmptyGroups } from '../utils'

import { IConditionSerializer, ISerializationOptions } from './interfaces/IConditionAdapter'

// `sql` is a value import, which would break the optional peer dependency
// contract if imported statically — require it lazily behind the same guard.
let kyselyAvailable = true
let sql: typeof kyselySql
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ;({ sql } = require('kysely') as { sql: typeof kyselySql })
} catch {
  kyselyAvailable = false
}

/**
 * Adapter to convert Condition to a Kysely-compatible applier.
 *
 * Like KnexConditionAdapter, this returns a function that applies the conditions
 * to an existing query builder, since a Kysely query builder cannot exist without
 * a `Kysely<DB>` instance and a target table.
 *
 * The applier is generic over any builder with a `.where()` method
 * (SelectQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder).
 * QB is intentionally unconstrained to avoid Kysely's invariant generics
 * (e.g. `WhereInterface<DB, TB>`) leaking into the public type.
 */
export type KyselyConditionApplier = <QB>(qb: QB) => QB

type KyselyExpressionBuilder = ExpressionBuilder<any, any>
type KyselyBoolExpression = Expression<SqlBool>

const KYSELY_BINARY_OPS: Record<string, string> = {
  $eq: '=',
  $ne: '<>',
  $gt: '>',
  $gte: '>=',
  $lt: '<',
  $lte: '<=',
  $in: 'in',
  $notin: 'not in',
  $nin: 'not in',
}

/**
 * Adapter to convert ConditionGroup or ConditionItem to Kysely query conditions.
 */
export class KyselyConditionAdapter implements IConditionSerializer<KyselyConditionApplier> {
  public constructor() {
    if (!kyselyAvailable) {
      throw new Error(
        'KyselyConditionAdapter requires the "kysely" package to be installed. ' + 'Install it with: npm install kysely or pnpm add kysely'
      )
    }
  }

  public serialize(condition: Condition, options?: ISerializationOptions): KyselyConditionApplier {
    return (<QB>(qb: QB): QB => {
      // Empty groups are a no-op by contract; prune them so a nested empty $or
      // cannot collapse the whole query to `1 = 0`
      const pruned = pruneEmptyGroups(condition)
      if (!pruned) {
        return qb
      }
      const whereCapable = qb as unknown as { where: (factory: (eb: KyselyExpressionBuilder) => KyselyBoolExpression) => unknown }
      const applied = whereCapable.where((eb) => this.#buildExpression(eb, pruned, options))
      return applied as QB
    }) as KyselyConditionApplier
  }

  #buildExpression(eb: KyselyExpressionBuilder, condition: Condition, options?: ISerializationOptions): KyselyBoolExpression {
    if (isConditionGroup(condition)) {
      return this.#buildGroup(eb, condition, options)
    }
    return this.#buildItem(eb, condition, options)
  }

  #buildGroup(eb: KyselyExpressionBuilder, group: ConditionGroup, options?: ISerializationOptions): KyselyBoolExpression {
    // The connective must come from the same key the items are read from —
    // never mix $and items with an $or connective
    const isOr = group.$or !== undefined
    const conditions = (isOr ? group.$or : group.$and) ?? []
    const exprs = conditions.map((c) => this.#buildExpression(eb, c, options))

    if (exprs.length === 1) {
      return exprs[0]
    }

    return isOr ? eb.or(exprs) : eb.and(exprs)
  }

  #buildItem(eb: KyselyExpressionBuilder, item: ConditionItem, options?: ISerializationOptions): KyselyBoolExpression {
    const field = mapFieldName(item.field, options)
    const { op } = item
    const value = 'value' in item ? (item as { value: unknown }).value : undefined

    // SQL `= NULL` never matches anything; $eq/$ne with null mean IS (NOT) NULL
    if ((op === '$eq' || op === '$ne') && value === null) {
      return eb(field, op === '$eq' ? 'is' : 'is not', null)
    }

    // `IN ()` is a syntax error in most dialects; an empty list can legally
    // arrive via ConditionBuilder.from() or a deserializer
    if ((op === '$in' || op === '$notin' || op === '$nin') && Array.isArray(value) && value.length === 0) {
      return op === '$in' ? sql<SqlBool>`1 = 0` : sql<SqlBool>`1 = 1`
    }

    if (PATTERN_OPS.has(op)) {
      return this.#buildPattern(field, op, value as string)
    }

    const binaryOp = KYSELY_BINARY_OPS[op]
    if (binaryOp) {
      return eb(field, binaryOp as any, value as any)
    }

    return this.#buildSpecialItem(eb, field, op, value)
  }

  /**
   * Pattern operators carry an explicit `ESCAPE ?` clause so that
   * backslash-escaped wildcards (see escapeLikeValue) behave identically on
   * every dialect — SQLite and MSSQL have no default escape character.
   * ILIKE is passed through as-is and requires a PostgreSQL-family dialect,
   * matching Kysely's own `ilike` binary operator.
   * Caveat: MySQL's server-side prepared statements reject a placeholder in
   * ESCAPE (error 1210); Kysely's default MysqlDialect uses the text protocol
   * and is unaffected.
   */
  #buildPattern(field: string, op: string, value: string): KyselyBoolExpression {
    const negated = op === '$notlike' || op === '$notilike'
    const insensitive = op === '$ilike' || op === '$notilike'
    const operator = sql.raw(`${negated ? 'not ' : ''}${insensitive ? 'ilike' : 'like'}`)
    return sql<SqlBool>`${sql.ref(field)} ${operator} ${value} escape ${'\\'}`
  }

  #buildSpecialItem(eb: KyselyExpressionBuilder, field: string, op: string, value: unknown): KyselyBoolExpression {
    switch (op) {
      case '$between': {
        const [min, max] = value as [unknown, unknown]
        return eb.and([eb(field, '>=', min), eb(field, '<=', max)])
      }
      case '$notbetween': {
        const [min, max] = value as [unknown, unknown]
        return eb.or([eb(field, '<', min), eb(field, '>', max)])
      }
      case '$isnull':
        return eb(field, 'is', null)
      case '$notnull':
        return eb(field, 'is not', null)
      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
