import { FilterQuery } from '@mikro-orm/core'

import { ConditionGroup, ConditionItem } from '../builder'

import { ConditionSerializer } from './interfaces/ConditionAdapter'

/**
 * Adapter to convert ConditionGroup or ConditionItem to MikroORM FilterQuery format
 */
export class MikroOrmConditionAdapter implements ConditionSerializer<FilterQuery<unknown>> {
  /**
   * Convert a ConditionGroup or ConditionItem to MikroORM FilterQuery
   */
  public serialize<T>(condition: ConditionGroup | ConditionItem): FilterQuery<T> {
    if (this.isConditionGroup(condition)) {
      return this.convertGroup<T>(condition)
    } else {
      return this.convertItem(condition) as FilterQuery<T>
    }
  }

  /**
   * Type guard to check if a condition is a ConditionGroup
   */
  private isConditionGroup(condition: ConditionGroup | ConditionItem): condition is ConditionGroup {
    return '$and' in condition || '$or' in condition
  }

  /**
   * Convert a ConditionGroup to MikroORM FilterQuery
   */
  private convertGroup<T>(group: ConditionGroup): FilterQuery<T> {
    if (group.$and) {
      const convertedConditions = group.$and.map((cond) => this.serialize<T>(cond))
      // For AND groups with a single condition, unwrap it
      if (convertedConditions.length === 1) {
        return convertedConditions[0]
      }
      return { $and: convertedConditions } as FilterQuery<T>
    } else if (group.$or) {
      const convertedConditions = group.$or.map((cond) => this.serialize<T>(cond))
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
  private convertItem(item: ConditionItem) {
    const { field, op } = item

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
