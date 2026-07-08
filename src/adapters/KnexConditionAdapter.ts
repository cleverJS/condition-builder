import type { Knex } from 'knex'

import { Condition, ConditionGroup, ConditionItem } from '../builder'
import { isConditionGroup, mapFieldName, PATTERN_OPS, pruneEmptyGroups } from '../utils'

import { IConditionSerializer, ISerializationOptions } from './interfaces/IConditionAdapter'

// Runtime check for knex availability
let knexAvailable = true
try {
  require.resolve('knex')
} catch {
  knexAvailable = false
}

/**
 * Adapter to convert Condition to Knex QueryBuilder
 *
 * Note: This adapter returns a function that applies conditions to a Knex QueryBuilder,
 * since we can't create a QueryBuilder without a Knex instance and table name.
 */
export type KnexConditionApplier = (qb: Knex.QueryBuilder) => Knex.QueryBuilder

const KNEX_COMPARISON_OPS: Record<string, string> = {
  $eq: '=',
  $ne: '<>',
  $gt: '>',
  $gte: '>=',
  $lt: '<',
  $lte: '<=',
}

// Dialects with a native case-insensitive ILIKE operator
const POSTGRES_CLIENTS = new Set(['pg', 'pg-native', 'postgres', 'postgresql', 'cockroachdb', 'redshift'])

/**
 * Adapter to convert ConditionGroup to Knex QueryBuilder conditions
 */
export class KnexConditionAdapter implements IConditionSerializer<KnexConditionApplier> {
  public constructor() {
    if (!knexAvailable) {
      throw new Error('KnexConditionAdapter requires the "knex" package to be installed. ' + 'Install it with: npm install knex or pnpm add knex')
    }
  }

  public serialize(condition: Condition, options?: ISerializationOptions): KnexConditionApplier {
    return (qb: Knex.QueryBuilder) => {
      // Empty groups are a no-op by contract; prune them so they cannot
      // poison the query at any nesting level
      const pruned = pruneEmptyGroups(condition)
      if (!pruned) {
        return qb
      }
      if (isConditionGroup(pruned)) {
        return this.#applyGroup(qb, pruned, options)
      }
      return this.#applyItem(qb, pruned, options)
    }
  }

  #applyGroup(qb: Knex.QueryBuilder, group: ConditionGroup, options?: ISerializationOptions): Knex.QueryBuilder {
    if (group.$and) {
      return this.#applyAndGroup(qb, group.$and, options)
    } else if (group.$or) {
      return this.#applyOrGroup(qb, group.$or, options)
    }

    return qb
  }

  #applyAndGroup(qb: Knex.QueryBuilder, conditions: Condition[], options?: ISerializationOptions): Knex.QueryBuilder {
    if (conditions.length === 0) {
      return qb
    }

    if (conditions.length === 1) {
      return this.#applyCondition(qb, conditions[0], options, false)
    }

    conditions.forEach((condition) => {
      if (isConditionGroup(condition)) {
        qb.andWhere((subQb) => this.#applyGroup(subQb, condition, options))
      } else {
        this.#applyItem(qb, condition, options)
      }
    })

    return qb
  }

  #applyOrGroup(qb: Knex.QueryBuilder, conditions: Condition[], options?: ISerializationOptions): Knex.QueryBuilder {
    if (conditions.length === 0) {
      return qb
    }

    if (conditions.length === 1) {
      return this.#applyCondition(qb, conditions[0], options, false)
    }

    qb.where((subQb) => {
      conditions.forEach((condition, index) => {
        const useOr = index > 0
        if (isConditionGroup(condition)) {
          const method = useOr ? 'orWhere' : 'where'
          subQb[method]((nestedQb: Knex.QueryBuilder) => this.#applyGroup(nestedQb, condition, options))
        } else {
          this.#applyItem(subQb, condition, options, useOr)
        }
      })
    })

    return qb
  }

  #applyCondition(qb: Knex.QueryBuilder, condition: Condition, options?: ISerializationOptions, useOr?: boolean): Knex.QueryBuilder {
    if (isConditionGroup(condition)) {
      return this.#applyGroup(qb, condition, options)
    }
    return this.#applyItem(qb, condition, options, useOr)
  }

  #applyItem(qb: Knex.QueryBuilder, item: ConditionItem, options?: ISerializationOptions, useOr = false): Knex.QueryBuilder {
    const field = mapFieldName(item.field, options)
    const { op } = item
    const value = 'value' in item ? (item as { value: unknown }).value : undefined

    // SQL `= NULL` never matches anything; $eq/$ne with null mean IS (NOT) NULL
    if ((op === '$eq' || op === '$ne') && value === null) {
      return this.#applyNullComparison(qb, field, op, useOr)
    }

    if (PATTERN_OPS.has(op)) {
      return this.#applyPattern(qb, field, op, value as string, useOr)
    }

    const comparisonOp = KNEX_COMPARISON_OPS[op]
    if (comparisonOp) {
      return useOr ? qb.orWhere(field, comparisonOp, value as any) : qb.where(field, comparisonOp, value as any)
    }

    return this.#applySpecialOp(qb, field, op, value, useOr)
  }

  #applyNullComparison(qb: Knex.QueryBuilder, field: string, op: '$eq' | '$ne', useOr: boolean): Knex.QueryBuilder {
    if (op === '$eq') {
      return useOr ? qb.orWhereNull(field) : qb.whereNull(field)
    }
    return useOr ? qb.orWhereNotNull(field) : qb.whereNotNull(field)
  }

  /**
   * Pattern operators are emitted as raw SQL with an explicit `ESCAPE ?` clause so
   * that backslash-escaped wildcards (see escapeLikeValue) behave identically on
   * every dialect — SQLite and MSSQL have no default escape character.
   * ILIKE is native on PostgreSQL-family dialects; elsewhere LIKE is used and
   * case-insensitivity relies on the column collation (same as Knex's whereILike).
   * Caveat: MySQL's server-side prepared statements reject a placeholder in
   * ESCAPE (error 1210); the default mysql/mysql2 clients use the text protocol
   * and are unaffected.
   */
  #applyPattern(qb: Knex.QueryBuilder, field: string, op: string, value: string, useOr: boolean): Knex.QueryBuilder {
    const negated = op === '$notlike' || op === '$notilike'
    const insensitive = op === '$ilike' || op === '$notilike'
    const likeOp = insensitive && this.#isPostgres(qb) ? 'ilike' : 'like'
    const sqlText = `?? ${negated ? 'not ' : ''}${likeOp} ? escape ?`
    const bindings = [field, value, '\\']
    return useOr ? qb.orWhereRaw(sqlText, bindings) : qb.whereRaw(sqlText, bindings)
  }

  #isPostgres(qb: Knex.QueryBuilder): boolean {
    const clientConfig = (qb as { client?: { config?: { client?: unknown }; dialect?: unknown } }).client
    const client = clientConfig?.config?.client ?? clientConfig?.dialect
    return typeof client === 'string' && POSTGRES_CLIENTS.has(client)
  }

  #applySpecialOp(qb: Knex.QueryBuilder, field: string, op: string, value: any, useOr: boolean): Knex.QueryBuilder {
    switch (op) {
      case '$in':
        return useOr ? qb.orWhereIn(field, value) : qb.whereIn(field, value)
      case '$nin':
      case '$notin':
        return useOr ? qb.orWhereNotIn(field, value) : qb.whereNotIn(field, value)
      case '$between':
        return useOr ? qb.orWhereBetween(field, value) : qb.whereBetween(field, value)
      case '$notbetween':
        return useOr ? qb.orWhereNotBetween(field, value) : qb.whereNotBetween(field, value)
      case '$isnull':
        return useOr ? qb.orWhereNull(field) : qb.whereNull(field)
      case '$notnull':
        return useOr ? qb.orWhereNotNull(field) : qb.whereNotNull(field)
      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
