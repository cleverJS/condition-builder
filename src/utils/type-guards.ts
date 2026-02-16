import { Condition, ConditionGroup, Range, SimpleValue } from '../builder/interfaces/types'

export function isConditionGroup(condition: Condition): condition is ConditionGroup {
  return '$and' in condition || '$or' in condition
}

export function isSimpleValue(value: unknown): value is SimpleValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  )
}

export function isComparisonValue(value: unknown): value is Exclude<SimpleValue, boolean | null> {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
}

export function isRangeValue(value: unknown): value is Range {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
}
