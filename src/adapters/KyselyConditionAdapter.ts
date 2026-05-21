import type { ExpressionBuilder, ExpressionWrapper, SqlBool } from 'kysely'

import { Condition, ConditionGroup, ConditionItem } from '../builder'
import { isConditionGroup, mapFieldName } from '../utils'

import { IConditionSerializer, ISerializationOptions } from './interfaces/IConditionAdapter'

let kyselyAvailable = true
try {
  require.resolve('kysely')
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
type KyselyBoolExpression = ExpressionWrapper<any, any, SqlBool>

const KYSELY_BINARY_OPS: Record<string, string> = {
  $eq: '=',
  $ne: '<>',
  $gt: '>',
  $gte: '>=',
  $lt: '<',
  $lte: '<=',
  $like: 'like',
  $notlike: 'not like',
  $ilike: 'ilike',
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
      throw new Error('KyselyConditionAdapter requires the "kysely" package to be installed. ' + 'Install it with: npm install kysely or pnpm add kysely')
    }
  }

  public serialize(condition: Condition, options?: ISerializationOptions): KyselyConditionApplier {
    return (<QB>(qb: QB): QB => {
      if (this.#isEmptyGroup(condition)) {
        return qb
      }
      const applied = (qb as any).where((eb: KyselyExpressionBuilder) => this.#buildExpression(eb, condition, options))
      return applied as QB
    }) as KyselyConditionApplier
  }

  #isEmptyGroup(condition: Condition): boolean {
    if (!isConditionGroup(condition)) {
      return false
    }
    const items = condition.$and ?? condition.$or
    return !items || items.length === 0
  }

  #buildExpression(eb: KyselyExpressionBuilder, condition: Condition, options?: ISerializationOptions): KyselyBoolExpression {
    if (isConditionGroup(condition)) {
      return this.#buildGroup(eb, condition, options)
    }
    return this.#buildItem(eb, condition, options)
  }

  #buildGroup(eb: KyselyExpressionBuilder, group: ConditionGroup, options?: ISerializationOptions): KyselyBoolExpression {
    const conditions = group.$and ?? group.$or ?? []
    const exprs = conditions.map((c) => this.#buildExpression(eb, c, options))

    if (exprs.length === 1) {
      return exprs[0]
    }

    if (group.$or) {
      return eb.or(exprs) as KyselyBoolExpression
    }
    return eb.and(exprs) as KyselyBoolExpression
  }

  #buildItem(eb: KyselyExpressionBuilder, item: ConditionItem, options?: ISerializationOptions): KyselyBoolExpression {
    const field = mapFieldName(item.field, options)
    const { op } = item
    const value = 'value' in item ? (item as { value: unknown }).value : undefined

    const binaryOp = KYSELY_BINARY_OPS[op]
    if (binaryOp) {
      return eb(field, binaryOp as any, value as any) as KyselyBoolExpression
    }

    return this.#buildSpecialItem(eb, field, op, value)
  }

  #buildSpecialItem(eb: KyselyExpressionBuilder, field: string, op: string, value: any): KyselyBoolExpression {
    switch (op) {
      case '$between': {
        const [min, max] = value
        return eb.and([eb(field, '>=', min), eb(field, '<=', max)]) as KyselyBoolExpression
      }
      case '$notbetween': {
        const [min, max] = value
        return eb.or([eb(field, '<', min), eb(field, '>', max)]) as KyselyBoolExpression
      }
      case '$isnull':
        return eb(field, 'is', null) as KyselyBoolExpression
      case '$notnull':
        return eb(field, 'is not', null) as KyselyBoolExpression
      default:
        throw new Error(`Unsupported operator: ${op}`)
    }
  }
}
