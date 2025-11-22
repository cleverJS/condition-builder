import { ConditionBuilder, ConditionGroup, ConditionItem } from '../builder'

import { ConditionDeserializer } from './interfaces/ConditionAdapter'

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
export class KendoFilterAdapter implements ConditionDeserializer<KendoFilter> {
  /**
   * Convert Kendo filter to ConditionBuilder
   */
  public deserialize(filter: KendoFilter): ConditionBuilder {
    let result: ConditionGroup | ConditionItem
    if (this.isCompositeFilter(filter)) {
      result = this.convertCompositeFilter(filter)
    } else {
      result = this.convertSimpleFilter(filter)
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
  private convertCompositeFilter(filter: IKendoGroup): ConditionGroup {
    const conditions = filter.filters.map((f) => {
      if (this.isCompositeFilter(f)) {
        return this.convertCompositeFilter(f)
      } else {
        return this.convertSimpleFilter(f)
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
  private convertSimpleFilter(filter: IKendoItem): ConditionItem | ConditionGroup {
    const { field, value } = filter
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

      case 'contains':
        // Convert 'contains' to ILIKE pattern
        return { field, op: '$ilike', value: `%${value}%` }

      case 'doesnotcontain':
        // Convert 'doesnotcontain' to NOT LIKE pattern
        return { field, op: '$notlike', value: `%${value}%` }

      case 'startswith':
        // Convert 'startswith' to ILIKE pattern
        return { field, op: '$ilike', value: `${value}%` }

      case 'endswith':
        // Convert 'endswith' to ILIKE pattern
        return { field, op: '$ilike', value: `%${value}` }

      case 'doesnotstartwith':
        // Convert 'doesnotstartwith' to NOT LIKE pattern
        return { field, op: '$notlike', value: `${value}%` }

      case 'doesnotendwith':
        // Convert 'doesnotendwith' to NOT LIKE pattern
        return { field, op: '$notlike', value: `%${value}` }

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
