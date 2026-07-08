import { FilterQuery } from '@mikro-orm/core'

import { Condition, ConditionGroup, ConditionItem } from '../builder'
import { isConditionGroup, mapFieldName, pruneEmptyGroups } from '../utils'

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
  // eslint-disable-next-line sonarjs/function-return-type -- FilterQuery<T> is itself a union type in MikroORM
  public serialize<T>(condition: Condition, options?: ISerializationOptions): FilterQuery<T> {
    // Empty groups are a no-op by contract; prune them at any nesting level
    const pruned = pruneEmptyGroups(condition)
    let result = {} as FilterQuery<T>
    if (pruned && isConditionGroup(pruned)) {
      result = this.#convertGroup<T>(pruned, options)
    } else if (pruned) {
      result = this.#convertItem(pruned, options) as FilterQuery<T>
    }
    return result
  }

  // eslint-disable-next-line sonarjs/function-return-type -- FilterQuery<T> is itself a union type in MikroORM
  #convertGroup<T>(group: ConditionGroup, options?: ISerializationOptions): FilterQuery<T> {
    const isOr = group.$or !== undefined
    const conditions = (isOr ? group.$or : group.$and) ?? []
    const converted = conditions.map((cond) => this.serialize<T>(cond, options))

    let result: FilterQuery<T>
    if (converted.length === 1) {
      result = converted[0]
    } else if (isOr) {
      result = { $or: converted } as FilterQuery<T>
    } else {
      result = { $and: converted } as FilterQuery<T>
    }
    return result
  }

  #convertItem(item: ConditionItem, options?: ISerializationOptions): Record<string, unknown> {
    const field = mapFieldName(item.field, options)
    const { op } = item
    const value: unknown = 'value' in item ? item.value : undefined

    const mikroOp = MIKRO_STANDARD_OPS[op]
    if (mikroOp) {
      return { [field]: { [mikroOp]: value } }
    }

    return this.#convertSpecialItem(field, op, value)
  }

  #convertSpecialItem(field: string, op: string, value: unknown): Record<string, unknown> {
    switch (op) {
      case '$eq':
        return { [field]: value }
      case '$notlike':
        return { [field]: { $not: { $like: value } } }
      case '$notilike':
        return { [field]: { $not: { $ilike: value } } }
      case '$between': {
        const [min, max] = value as [unknown, unknown]
        return { [field]: { $gte: min, $lte: max } }
      }
      case '$notbetween': {
        const [min, max] = value as [unknown, unknown]
        return {
          $or: [{ [field]: { $lt: min } }, { [field]: { $gt: max } }],
        }
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
