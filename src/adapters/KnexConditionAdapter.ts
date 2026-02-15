import type { Knex } from 'knex'

import { Condition, ConditionGroup, ConditionItem } from '../builder'

import { isConditionGroup, mapFieldName } from './adapter-utils'
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
      if (isConditionGroup(condition)) {
        return this.applyGroup(qb, condition, options)
      } else {
        return this.applyItem(qb, condition, options)
      }
    }
  }

  /**
   * Apply a ConditionGroup to Knex QueryBuilder
   */
  private applyGroup(qb: Knex.QueryBuilder, group: ConditionGroup, options?: ISerializationOptions): Knex.QueryBuilder {
    if (group.$and) {
      // For AND groups, we can apply conditions directly or use andWhere for nested groups
      if (group.$and.length === 0) {
        return qb
      }

      if (group.$and.length === 1) {
        // Single condition - apply directly
        const condition = group.$and[0]
        if (isConditionGroup(condition)) {
          return this.applyGroup(qb, condition, options)
        } else {
          return this.applyItem(qb, condition, options)
        }
      }

      // Multiple conditions - apply all with AND
      group.$and.forEach((condition) => {
        if (isConditionGroup(condition)) {
          // Nested group - wrap in andWhere callback
          qb.andWhere((subQb) => this.applyGroup(subQb, condition, options))
        } else {
          this.applyItem(qb, condition, options)
        }
      })

      return qb
    } else if (group.$or) {
      // For OR groups, use orWhere
      if (group.$or.length === 0) {
        return qb
      }

      if (group.$or.length === 1) {
        // Single condition - apply directly
        const condition = group.$or[0]
        if (isConditionGroup(condition)) {
          return this.applyGroup(qb, condition, options)
        } else {
          return this.applyItem(qb, condition, options)
        }
      }

      // Multiple conditions - wrap in where callback with OR logic
      qb.where((subQb) => {
        group.$or!.forEach((condition, index) => {
          if (index === 0) {
            // First condition uses where
            if (isConditionGroup(condition)) {
              subQb.where((nestedQb) => this.applyGroup(nestedQb, condition, options))
            } else {
              this.applyItem(subQb, condition, options)
            }
          } else {
            // Subsequent conditions use orWhere
            if (isConditionGroup(condition)) {
              subQb.orWhere((nestedQb) => this.applyGroup(nestedQb, condition, options))
            } else {
              this.applyItem(subQb, condition, options, true)
            }
          }
        })
      })

      return qb
    }

    return qb
  }

  /**
   * Apply a ConditionItem to Knex QueryBuilder
   */
  private applyItem(qb: Knex.QueryBuilder, item: ConditionItem, options?: ISerializationOptions, useOr = false): Knex.QueryBuilder {
    const field = mapFieldName(item.field, options)
    const { op } = item

    switch (op) {
      case '$eq':
        return useOr ? qb.orWhere(field, '=', item.value) : qb.where(field, '=', item.value)

      case '$ne':
        return useOr ? qb.orWhere(field, '<>', item.value) : qb.where(field, '<>', item.value)

      case '$gt':
        return useOr ? qb.orWhere(field, '>', item.value) : qb.where(field, '>', item.value)

      case '$gte':
        return useOr ? qb.orWhere(field, '>=', item.value) : qb.where(field, '>=', item.value)

      case '$lt':
        return useOr ? qb.orWhere(field, '<', item.value) : qb.where(field, '<', item.value)

      case '$lte':
        return useOr ? qb.orWhere(field, '<=', item.value) : qb.where(field, '<=', item.value)

      case '$in':
        return useOr ? qb.orWhereIn(field, item.value) : qb.whereIn(field, item.value)

      case '$nin':
      case '$notin':
        return useOr ? qb.orWhereNotIn(field, item.value) : qb.whereNotIn(field, item.value)

      case '$like':
        return useOr ? qb.orWhere(field, 'like', item.value) : qb.where(field, 'like', item.value)

      case '$notlike':
        return useOr ? qb.orWhereNot(field, 'like', item.value) : qb.whereNot(field, 'like', item.value)

      case '$ilike':
        return useOr ? qb.orWhereILike(field, item.value) : qb.whereILike(field, item.value)

      case '$between':
        return useOr ? qb.orWhereBetween(field, item.value) : qb.whereBetween(field, item.value)

      case '$notbetween':
        return useOr ? qb.orWhereNotBetween(field, item.value) : qb.whereNotBetween(field, item.value)

      case '$isnull':
        return useOr ? qb.orWhereNull(field) : qb.whereNull(field)

      case '$notnull':
        return useOr ? qb.orWhereNotNull(field) : qb.whereNotNull(field)

      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
