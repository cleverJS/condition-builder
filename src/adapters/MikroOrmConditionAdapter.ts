import { FilterQuery, raw } from '@mikro-orm/core'

import { Condition, ConditionGroup, ConditionItem } from '../builder'
import type { RawCondition } from '../builder/interfaces/types'

import { IConditionSerializer, ISerializationOptions } from './interfaces/IConditionAdapter'

// Runtime check for @mikro-orm/core availability
let mikroOrmAvailable = true
let rawHelperAvailable = true
try {
  require.resolve('@mikro-orm/core')
  // Check if raw helper is available
  if (typeof raw !== 'function') {
    rawHelperAvailable = false
  }
} catch {
  mikroOrmAvailable = false
  rawHelperAvailable = false
}

/**
 * Adapter to convert ConditionGroup or ConditionItem to MikroORM FilterQuery format
 */
export class MikroOrmConditionAdapter implements IConditionSerializer<FilterQuery<unknown>> {
  public constructor() {
    if (!mikroOrmAvailable) {
      throw new Error(
        'MikroOrmConditionAdapter requires the "@mikro-orm/core" package to be installed. ' +
          'Install it with: npm install @mikro-orm/core or pnpm add @mikro-orm/core'
      )
    }
  }

  /**
   * Convert a ConditionGroup or ConditionItem to MikroORM FilterQuery
   */
  public serialize<T>(condition: Condition, options?: ISerializationOptions): FilterQuery<T> {
    if (this.isConditionGroup(condition)) {
      return this.convertGroup<T>(condition, options)
    } else if (this.isRawCondition(condition)) {
      return this.convertRaw<T>(condition)
    } else {
      return this.convertItem(condition, options) as FilterQuery<T>
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
   * Convert a RawCondition to MikroORM FilterQuery using raw() helper
   * MikroORM documentation: https://mikro-orm.io/docs/raw-queries
   */
  private convertRaw<T>(rawCondition: RawCondition): FilterQuery<T> {
    if (!rawHelperAvailable) {
      throw new Error(
        'MikroORM raw() helper is not available. Make sure you are using a version of @mikro-orm/core that supports the raw() helper function.'
      )
    }

    // MikroORM uses the raw() helper function to create raw SQL fragments
    // Format: raw('sql string', bindings)
    // The raw() function returns a special object that MikroORM recognizes
    if (rawCondition.bindings !== undefined && rawCondition.bindings.length > 0) {
      return raw(rawCondition.$raw, rawCondition.bindings) as FilterQuery<T>
    }
    return raw(rawCondition.$raw) as FilterQuery<T>
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
   * Convert a ConditionGroup to MikroORM FilterQuery
   */
  private convertGroup<T>(group: ConditionGroup, options?: ISerializationOptions): FilterQuery<T> {
    if (group.$and) {
      const convertedConditions = group.$and.map((cond) => this.serialize<T>(cond, options))
      // For AND groups with a single condition, unwrap it
      if (convertedConditions.length === 1) {
        return convertedConditions[0]
      }
      return { $and: convertedConditions } as FilterQuery<T>
    } else if (group.$or) {
      const convertedConditions = group.$or.map((cond) => this.serialize<T>(cond, options))
      // For OR groups with a single condition, unwrap it
      if (convertedConditions.length === 1) {
        return convertedConditions[0]
      }
      return { $or: convertedConditions } as FilterQuery<T>
    }

    // Empty group - shouldn't happen but return an empty object
    return {}
  }

  /**
   * Convert a ConditionItem to MikroORM FilterQuery
   */
  private convertItem(item: ConditionItem, options?: ISerializationOptions) {
    const field = this.mapFieldName(item.field, options)
    const { op } = item

    // Handle operators that map directly to MikroORM
    switch (op) {
      case '$eq':
        // MikroORM allows simple equality as { field: value }
        return { [field]: item.value }

      case '$ne':
        return { [field]: { $ne: item.value } }

      case '$gt':
        return { [field]: { $gt: item.value } }

      case '$gte':
        return { [field]: { $gte: item.value } }

      case '$lt':
        return { [field]: { $lt: item.value } }

      case '$lte':
        return { [field]: { $lte: item.value } }

      case '$in':
        return { [field]: { $in: item.value } }

      case '$notin':
      case '$nin':
        return { [field]: { $nin: item.value } }

      case '$like':
        // MikroORM uses $like for LIKE queries
        return { [field]: { $like: item.value } }

      case '$notlike':
        // MikroORM doesn't have $notlike, use $not with $like
        return { [field]: { $not: { $like: item.value } } }

      case '$ilike':
        // MikroORM uses $ilike for case-insensitive LIKE
        return { [field]: { $ilike: item.value } }

      case '$between':
        // MikroORM doesn't have native $between, use $gte and $lte
        const [min, max] = item.value
        return { [field]: { $gte: min, $lte: max } }

      case '$notbetween':
        // NOT BETWEEN: value < min OR value > max
        return {
          $or: [{ [field]: { $lt: item.value[0] } }, { [field]: { $gt: item.value[1] } }],
        }

      case '$isnull':
        return { [field]: null }

      case '$notnull':
        return { [field]: { $ne: null } }

      default:
        // This should never happen with proper TypeScript types
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
