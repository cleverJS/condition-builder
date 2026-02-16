import { FilterQuery } from '@mikro-orm/core'

import { Condition, ConditionGroup, ConditionItem } from '../builder'
import { isConditionGroup, mapFieldName } from '../utils'

import { IConditionSerializer, ISerializationOptions } from './interfaces/IConditionAdapter'

// Runtime check for @mikro-orm/core availability
let mikroOrmAvailable = true
try {
  require.resolve('@mikro-orm/core')
} catch {
  mikroOrmAvailable = false
}

const MIKRO_STANDARD_OPS: Record<string, string> = {
  $ne: '$ne',
  $gt: '$gt',
  $gte: '$gte',
  $lt: '$lt',
  $lte: '$lte',
  $in: '$in',
  $nin: '$nin',
  $notin: '$nin',
  $like: '$like',
  $ilike: '$ilike',
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
    let result = {} as FilterQuery<T>
    if (isConditionGroup(condition)) {
      result = this.#convertGroup<T>(condition, options)
    } else {
      result = this.#convertItem(condition, options) as FilterQuery<T>
    }

    return result
  }

  #convertGroup<T>(group: ConditionGroup, options?: ISerializationOptions): FilterQuery<T> {
    if (group.$and) {
      const convertedConditions = group.$and.map((cond) => this.serialize<T>(cond, options))
      if (convertedConditions.length === 1) {
        return convertedConditions[0]
      }
      return { $and: convertedConditions } as FilterQuery<T>
    } else if (group.$or) {
      const convertedConditions = group.$or.map((cond) => this.serialize<T>(cond, options))
      if (convertedConditions.length === 1) {
        return convertedConditions[0]
      }
      return { $or: convertedConditions } as FilterQuery<T>
    }

    return {}
  }

  #convertItem(item: ConditionItem, options?: ISerializationOptions) {
    const field = mapFieldName(item.field, options)
    const { op } = item
    const value = 'value' in item ? item.value : undefined

    const mikroOp = MIKRO_STANDARD_OPS[op]
    if (mikroOp) {
      return { [field]: { [mikroOp]: value } }
    }

    return this.#convertSpecialItem(field, op, value)
  }

  #convertSpecialItem(field: string, op: string, value: any) {
    switch (op) {
      case '$eq':
        return { [field]: value }
      case '$notlike':
        return { [field]: { $not: { $like: value } } }
      case '$between': {
        const [min, max] = value
        return { [field]: { $gte: min, $lte: max } }
      }
      case '$notbetween':
        return {
          $or: [{ [field]: { $lt: value[0] } }, { [field]: { $gt: value[1] } }],
        }
      case '$isnull':
        return { [field]: null }
      case '$notnull':
        return { [field]: { $ne: null } }
      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
