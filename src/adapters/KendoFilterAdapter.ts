import { Condition, ConditionBuilder, ConditionGroup } from '../builder'
import { escapeLikeValue, mapFieldName } from '../utils'

import { IConditionDeserializer, IDeserializationOptions } from './interfaces/IConditionAdapter'

/**
 * Kendo UI DataSource filter format
 * @see https://docs.telerik.com/kendo-ui/api/javascript/data/datasource/configuration/filter
 */
export interface IKendoItem {
  field: string
  operator: KendoOperator
  value: any
}

export interface IKendoGroup {
  logic: 'and' | 'or'
  filters: Array<IKendoItem | IKendoGroup>
}

export type KendoFilter = IKendoItem | IKendoGroup

export enum EKendoOperator {
  EQ = 'eq',
  NEQ = 'neq',
  ISNULL = 'isnull',
  ISNOTNULL = 'isnotnull',
  LT = 'lt',
  LTE = 'lte',
  GT = 'gt',
  GTE = 'gte',
  STARTSWITH = 'startswith',
  ENDSWITH = 'endswith',
  CONTAINS = 'contains',
  IN = 'in',
  ISEMPTY = 'isempty',
  ISNULLOREMPTY = 'isnullorempty',
  ISNOTEMPTY = 'isnotempty',
  ISNOTNULLOREMPTY = 'isnotnullorempty',
  DOESNOTSTARTWITH = 'doesnotstartwith',
  DOESNOTCONTAIN = 'doesnotcontain',
  DOESNOTENDWITH = 'doesnotendwith',
}

/**
 * Kendo UI filter operators
 */
export type KendoOperator =
  | 'eq' // Equal to
  | 'neq' // Not equal to
  | 'lt' // Less than
  | 'lte' // Less than or equal to
  | 'gt' // Greater than
  | 'gte' // Greater than or equal to
  | 'startswith' // Starts with
  | 'endswith' // Ends with
  | 'contains' // Contains
  | 'doesnotcontain' // Does not contain
  | 'doesnotstartwith' // Does not start with
  | 'doesnotendwith' // Does not end with
  | 'isempty' // Is empty
  | 'isnotempty' // Is not empty
  | 'isnull' // Is null
  | 'isnotnull' // Is not null
  | 'isnullorempty' // Is null or empty
  | 'isnotnullorempty' // Is not null or empty
  | 'in' // In array

type KendoConverter = (field: string, value: any) => Condition

const KENDO_CONVERTERS: Record<string, KendoConverter> = {
  eq: (field, value) => (value === null ? { field, op: '$isnull' } : { field, op: '$eq', value }),
  neq: (field, value) => (value === null ? { field, op: '$notnull' } : { field, op: '$ne', value }),
  gt: (field, value) => ({ field, op: '$gt', value }),
  gte: (field, value) => ({ field, op: '$gte', value }),
  lt: (field, value) => ({ field, op: '$lt', value }),
  lte: (field, value) => ({ field, op: '$lte', value }),
  in: (field, value) => ({ field, op: '$in', value }),
  contains: (field, value) => ({ field, op: '$ilike', value: `%${escapeLikeValue(String(value))}%` }),
  doesnotcontain: (field, value) => ({ field, op: '$notlike', value: `%${escapeLikeValue(String(value))}%` }),
  startswith: (field, value) => ({ field, op: '$ilike', value: `${escapeLikeValue(String(value))}%` }),
  endswith: (field, value) => ({ field, op: '$ilike', value: `%${escapeLikeValue(String(value))}` }),
  doesnotstartwith: (field, value) => ({ field, op: '$notlike', value: `${escapeLikeValue(String(value))}%` }),
  doesnotendwith: (field, value) => ({ field, op: '$notlike', value: `%${escapeLikeValue(String(value))}` }),
  isnull: (field) => ({ field, op: '$isnull' }),
  isnotnull: (field) => ({ field, op: '$notnull' }),
  isempty: (field) => ({ field, op: '$eq', value: '' }),
  isnotempty: (field) => ({ field, op: '$ne', value: '' }),
  isnullorempty: (field) =>
    ({
      $or: [
        { field, op: '$isnull' },
        { field, op: '$eq', value: '' },
      ],
    }) as ConditionGroup,
  isnotnullorempty: (field) =>
    ({
      $and: [
        { field, op: '$notnull' },
        { field, op: '$ne', value: '' },
      ],
    }) as ConditionGroup,
}

/**
 * Adapter to convert Kendo UI DataSource filter to ConditionGroup
 *
 * Converts Kendo UI filter format to the internal ConditionGroup format.
 * Supports both simple filters and composite filters with nested logic.
 *
 * @example
 * const adapter = new KendoFilterAdapter()
 * const kendoFilter = {
 *   logic: 'and',
 *   filters: [
 *     { field: 'name', operator: 'eq', value: 'John' },
 *     { field: 'age', operator: 'gt', value: 25 }
 *   ]
 * }
 * const conditionGroup = adapter.deserialize(kendoFilter)
 */
export class KendoFilterAdapter implements IConditionDeserializer<KendoFilter> {
  /**
   * Convert Kendo filter to ConditionBuilder
   * @param filter - The Kendo filter to deserialize
   * @param options - Deserialization options including field mapping
   */
  public deserialize(filter: KendoFilter, options?: IDeserializationOptions): ConditionBuilder {
    let result: Condition
    if (this.#isCompositeFilter(filter)) {
      result = this.#convertCompositeFilter(filter, options)
    } else {
      result = this.#convertSimpleFilter(filter, options)
    }

    return ConditionBuilder.from(result)
  }

  #isCompositeFilter(filter: KendoFilter): filter is IKendoGroup {
    return 'logic' in filter && 'filters' in filter
  }

  #convertCompositeFilter(filter: IKendoGroup, options?: IDeserializationOptions): ConditionGroup {
    const conditions = filter.filters.map((f) => {
      if (this.#isCompositeFilter(f)) {
        return this.#convertCompositeFilter(f, options)
      } else {
        return this.#convertSimpleFilter(f, options)
      }
    })

    if (filter.logic === 'and') {
      return { $and: conditions }
    } else {
      return { $or: conditions }
    }
  }

  #convertSimpleFilter(filter: IKendoItem, options?: IDeserializationOptions): Condition {
    const { value } = filter
    const field = mapFieldName(filter.field, options)
    const operator = filter.operator.toLowerCase() as KendoOperator

    const converter = KENDO_CONVERTERS[operator]
    if (!converter) {
      throw new Error(`Unsupported Kendo operator: ${filter.operator}`)
    }

    return converter(field, value)
  }
}
