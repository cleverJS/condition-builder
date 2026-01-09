import type { Knex } from 'knex'

import { Condition, ConditionGroup, ConditionItem, RawCondition } from '../builder'

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
      if (this.isConditionGroup(condition)) {
        return this.applyGroup(qb, condition, options)
      } else if (this.isRawCondition(condition)) {
        return this.applyRaw(qb, condition)
      } else {
        return this.applyItem(qb, condition, options)
      }
    }
  }

  /**
   * Type guard to check if a condition is a ConditionGroup
   */
  private isConditionGroup(condition: Condition): condition is ConditionGroup {
    return '$and' in condition || '$or' in condition
  }

  /**
   * Type guard to check if a condition is a RawCondition
   */
  private isRawCondition(condition: Condition): condition is RawCondition {
    return '$raw' in condition
  }

  /**
   * Apply field name mapping if provided
   */
  private mapFieldName(fieldName: string, options?: ISerializationOptions): string {
    if (options?.fieldMapping && options.fieldMapping[fieldName]) {
      return options.fieldMapping[fieldName]
    }
    return fieldName
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
        if (this.isConditionGroup(condition)) {
          return this.applyGroup(qb, condition, options)
        } else if (this.isRawCondition(condition)) {
          return this.applyRaw(qb, condition)
        } else {
          return this.applyItem(qb, condition, options)
        }
      }

      // Multiple conditions - apply all with AND
      group.$and.forEach((condition) => {
        if (this.isConditionGroup(condition)) {
          // Nested group - wrap in andWhere callback
          qb.andWhere((subQb) => this.applyGroup(subQb, condition, options))
        } else if (this.isRawCondition(condition)) {
          this.applyRaw(qb, condition)
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
        if (this.isConditionGroup(condition)) {
          return this.applyGroup(qb, condition, options)
        } else if (this.isRawCondition(condition)) {
          return this.applyRaw(qb, condition)
        } else {
          return this.applyItem(qb, condition, options)
        }
      }

      // Multiple conditions - wrap in where callback with OR logic
      qb.where((subQb) => {
        group.$or!.forEach((condition, index) => {
          if (index === 0) {
            // First condition uses where
            if (this.isConditionGroup(condition)) {
              subQb.where((nestedQb) => this.applyGroup(nestedQb, condition, options))
            } else if (this.isRawCondition(condition)) {
              this.applyRaw(subQb, condition)
            } else {
              this.applyItem(subQb, condition, options)
            }
          } else {
            // Subsequent conditions use orWhere
            if (this.isConditionGroup(condition)) {
              subQb.orWhere((nestedQb) => this.applyGroup(nestedQb, condition, options))
            } else if (this.isRawCondition(condition)) {
              this.applyRawWithOr(subQb, condition)
            } else {
              this.applyItemWithOr(subQb, condition, options)
            }
          }
        })
      })

      return qb
    }

    return qb
  }

  /**
   * Apply a RawCondition to Knex QueryBuilder using whereRaw
   */
  private applyRaw(qb: Knex.QueryBuilder, raw: RawCondition): Knex.QueryBuilder {
    if (raw.bindings !== undefined && raw.bindings.length > 0) {
      return qb.whereRaw(raw.$raw, raw.bindings)
    }
    return qb.whereRaw(raw.$raw)
  }

  /**
   * Apply a RawCondition to Knex QueryBuilder using orWhereRaw
   */
  private applyRawWithOr(qb: Knex.QueryBuilder, raw: RawCondition): Knex.QueryBuilder {
    if (raw.bindings !== undefined && raw.bindings.length > 0) {
      return qb.orWhereRaw(raw.$raw, raw.bindings)
    }
    return qb.orWhereRaw(raw.$raw)
  }

  /**
   * Apply a ConditionItem to Knex QueryBuilder using where
   */
  private applyItem(qb: Knex.QueryBuilder, item: ConditionItem, options?: ISerializationOptions): Knex.QueryBuilder {
    const field = this.mapFieldName(item.field, options)
    const { op } = item

    switch (op) {
      case '$eq':
        return qb.where(field, '=', item.value)

      case '$ne':
        return qb.where(field, '<>', item.value)

      case '$gt':
        return qb.where(field, '>', item.value)

      case '$gte':
        return qb.where(field, '>=', item.value)

      case '$lt':
        return qb.where(field, '<', item.value)

      case '$lte':
        return qb.where(field, '<=', item.value)

      case '$in':
        return qb.whereIn(field, item.value)

      case '$notin':
      case '$nin':
        return qb.whereNotIn(field, item.value)

      case '$like':
        return qb.where(field, 'like', item.value)

      case '$notlike':
        return qb.whereNot(field, 'like', item.value)

      case '$ilike':
        // PostgreSQL case-insensitive LIKE
        return qb.whereILike(field, item.value)

      case '$between':
        return qb.whereBetween(field, item.value)

      case '$notbetween':
        return qb.whereNotBetween(field, item.value)

      case '$isnull':
        return qb.whereNull(field)

      case '$notnull':
        return qb.whereNotNull(field)

      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }

  /**
   * Apply a ConditionItem to Knex QueryBuilder using orWhere
   */
  private applyItemWithOr(qb: Knex.QueryBuilder, item: ConditionItem, options?: ISerializationOptions): Knex.QueryBuilder {
    const field = this.mapFieldName(item.field, options)
    const { op } = item

    switch (op) {
      case '$eq':
        return qb.orWhere(field, '=', item.value)

      case '$ne':
        return qb.orWhere(field, '<>', item.value)

      case '$gt':
        return qb.orWhere(field, '>', item.value)

      case '$gte':
        return qb.orWhere(field, '>=', item.value)

      case '$lt':
        return qb.orWhere(field, '<', item.value)

      case '$lte':
        return qb.orWhere(field, '<=', item.value)

      case '$in':
        return qb.orWhereIn(field, item.value)

      case '$notin':
        return qb.orWhereNotIn(field, item.value)

      case '$like':
        return qb.orWhere(field, 'like', item.value)

      case '$notlike':
        return qb.orWhereNot(field, 'like', item.value)

      case '$ilike':
        return qb.orWhereILike(field, item.value)

      case '$between':
        return qb.orWhereBetween(field, item.value)

      case '$notbetween':
        return qb.orWhereNotBetween(field, item.value)

      case '$isnull':
        return qb.orWhereNull(field)

      case '$notnull':
        return qb.orWhereNotNull(field)

      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
