import { Condition, ConditionBuilder, ConditionGroup } from '../builder'

import { mapFieldName } from './adapter-utils'
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
  private static escapeLikeValue(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&')
  }

  /**
   * Convert Kendo filter to ConditionBuilder
   * @param filter - The Kendo filter to deserialize
   * @param options - Deserialization options including field mapping
   */
  public deserialize(filter: KendoFilter, options?: IDeserializationOptions): ConditionBuilder {
    let result: Condition
    if (this.isCompositeFilter(filter)) {
      result = this.convertCompositeFilter(filter, options)
    } else {
      result = this.convertSimpleFilter(filter, options)
    }

    return ConditionBuilder.from(result)
  }

  /**
   * Type guard to check if a filter is a composite filter
   */
  private isCompositeFilter(filter: KendoFilter): filter is IKendoGroup {
    return 'logic' in filter && 'filters' in filter
  }

  /**
   * Convert a composite filter (with logic and nested filters) to ConditionGroup
   */
  private convertCompositeFilter(filter: IKendoGroup, options?: IDeserializationOptions): ConditionGroup {
    const conditions = filter.filters.map((f) => {
      if (this.isCompositeFilter(f)) {
        return this.convertCompositeFilter(f, options)
      } else {
        return this.convertSimpleFilter(f, options)
      }
    })

    if (filter.logic === 'and') {
      return { $and: conditions }
    } else {
      return { $or: conditions }
    }
  }

  /**
   * Convert a simple Kendo filter to ConditionItem or ConditionGroup
   */
  private convertSimpleFilter(filter: IKendoItem, options?: IDeserializationOptions): Condition {
    const { value } = filter
    const field = mapFieldName(filter.field, options)
    // Normalize operator to lowercase for case-insensitive matching
    const operator = filter.operator.toLowerCase() as KendoOperator

    switch (operator) {
      case 'eq':
        if (value === null) {
          return { field, op: '$isnull' }
        }

        return { field, op: '$eq', value }

      case 'neq':
        if (value === null) {
          return { field, op: '$notnull' }
        }

        return { field, op: '$ne', value }

      case 'gt':
        return { field, op: '$gt', value }

      case 'gte':
        return { field, op: '$gte', value }

      case 'lt':
        return { field, op: '$lt', value }

      case 'lte':
        return { field, op: '$lte', value }

      case 'in':
        return { field, op: '$in', value }

      case 'contains': {
        const escaped = KendoFilterAdapter.escapeLikeValue(String(value))
        return { field, op: '$ilike', value: `%${escaped}%` }
      }

      case 'doesnotcontain': {
        const escaped = KendoFilterAdapter.escapeLikeValue(String(value))
        return { field, op: '$notlike', value: `%${escaped}%` }
      }

      case 'startswith': {
        const escaped = KendoFilterAdapter.escapeLikeValue(String(value))
        return { field, op: '$ilike', value: `${escaped}%` }
      }

      case 'endswith': {
        const escaped = KendoFilterAdapter.escapeLikeValue(String(value))
        return { field, op: '$ilike', value: `%${escaped}` }
      }

      case 'doesnotstartwith': {
        const escaped = KendoFilterAdapter.escapeLikeValue(String(value))
        return { field, op: '$notlike', value: `${escaped}%` }
      }

      case 'doesnotendwith': {
        const escaped = KendoFilterAdapter.escapeLikeValue(String(value))
        return { field, op: '$notlike', value: `%${escaped}` }
      }

      case 'isnull':
        return { field, op: '$isnull' }

      case 'isnotnull':
        return { field, op: '$notnull' }

      case 'isempty':
        // 'isempty' typically means empty string
        return { field, op: '$eq', value: '' }

      case 'isnotempty':
        // 'isnotempty' means not empty string
        return { field, op: '$ne', value: '' }

      case 'isnullorempty':
        // 'isnullorempty' means null OR empty string - create an OR group
        return {
          $or: [
            { field, op: '$isnull' },
            { field, op: '$eq', value: '' },
          ],
        } as ConditionGroup

      case 'isnotnullorempty':
        // 'isnotnullorempty' means not null AND not empty string - create an AND group
        return {
          $and: [
            { field, op: '$notnull' },
            { field, op: '$ne', value: '' },
          ],
        } as ConditionGroup

      default:
        throw new Error(`Unsupported Kendo operator: ${filter.operator}`)
    }
  }
}
