import { Condition, ConditionGroup, ConditionItem } from '../builder/interfaces/types'

import { isConditionGroup, isRangeValue, isSimpleValue } from './type-guards'

export const NULL_OPS: ReadonlySet<string> = new Set(['$isnull', '$notnull'])
export const ARRAY_OPS: ReadonlySet<string> = new Set(['$in', '$notin', '$nin'])
export const BETWEEN_OPS: ReadonlySet<string> = new Set(['$between', '$notbetween'])
export const PATTERN_OPS: ReadonlySet<string> = new Set(['$like', '$notlike', '$ilike', '$notilike'])
export const COMPARISON_OPS: ReadonlySet<string> = new Set(['$gt', '$gte', '$lt', '$lte'])
export const BASIC_OPS: ReadonlySet<string> = new Set(['$eq', '$ne'])

export const KNOWN_OPERATORS: ReadonlySet<string> = new Set([
  ...BASIC_OPS,
  ...COMPARISON_OPS,
  ...PATTERN_OPS,
  ...ARRAY_OPS,
  ...BETWEEN_OPS,
  ...NULL_OPS,
])

/**
 * Normalize an operator to its canonical form: lowercase with a `$` prefix
 * (e.g. 'EQ' -> '$eq', '$ILIKE' -> '$ilike'). Does not check that the result is known.
 */
export function normalizeOperator(op: string): string {
  const lower = op.toLowerCase()
  return lower.startsWith('$') ? lower : `$${lower}`
}

/**
 * Validate a single ConditionItem. Unlike the fluent FieldBuilder API, empty arrays
 * for $in/$notin are accepted here: deserialized input (e.g. an empty multi-select
 * filter) legitimately produces them, and adapters serialize them as always-false
 * (or always-true for $notin).
 */
export function validateConditionItem(item: unknown, path = 'condition'): asserts item is ConditionItem {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`${path}: a condition item must be an object, got ${describe(item)}`)
  }

  const { field, op } = item as { field?: unknown; op?: unknown }
  if (typeof field !== 'string' || field.trim().length === 0) {
    throw new Error(`${path}: 'field' must be a non-empty string, got ${describe(field)}`)
  }
  if (typeof op !== 'string' || !KNOWN_OPERATORS.has(op)) {
    throw new Error(`${path} (field '${field}'): unknown operator ${describe(op)}`)
  }

  const value = (item as { value?: unknown }).value
  validateOperatorValue(op, value, `${path} (field '${field}')`)
}

/**
 * Validate a whole Condition tree: groups must contain exactly one of $and/$or
 * holding an array, and every leaf must be a valid ConditionItem.
 */
export function validateCondition(condition: unknown, path = 'condition'): asserts condition is Condition {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    throw new Error(`${path}: a condition must be an object, got ${describe(condition)}`)
  }

  // Group-ness is decided by `!== undefined` (not key presence) to stay
  // consistent with pruneEmptyGroups; JSON input can never carry undefined
  const group = condition as ConditionGroup
  const hasAnd = group.$and !== undefined
  const hasOr = group.$or !== undefined

  if (hasAnd && hasOr) {
    throw new Error(`${path}: a condition group must contain either '$and' or '$or', not both`)
  }

  if (hasAnd || hasOr) {
    const key = hasAnd ? '$and' : '$or'
    const children = group[key as '$and']
    if (!Array.isArray(children)) {
      throw new Error(`${path}.${key} must be an array, got ${describe(children)}`)
    }
    children.forEach((child, index) => validateCondition(child, `${path}.${key}[${index}]`))
    return
  }

  validateConditionItem(condition, path)
}

/**
 * Remove empty groups from a condition tree. An empty group is a no-op by contract:
 * it neither matches everything nor nothing, it simply does not constrain the query.
 * Returns null when the whole tree is empty. Never mutates the input.
 */
export function pruneEmptyGroups(condition: Condition): Condition | null {
  if (!isConditionGroup(condition)) {
    return condition
  }

  if (condition.$and !== undefined && condition.$or !== undefined) {
    throw new Error("A condition group must contain either '$and' or '$or', not both")
  }

  const key = condition.$and !== undefined ? '$and' : '$or'
  const children = condition[key] ?? []
  const pruned = children.map(pruneEmptyGroups).filter((child): child is Condition => child !== null)

  if (pruned.length === 0) {
    return null
  }

  return { [key]: pruned }
}

/**
 * Bring every operator in a condition tree to canonical form in place
 * (e.g. '$EQ' -> '$eq', 'like' -> '$like'). Tolerates malformed trees so it can
 * run before validation. Call only on trees you own (a fresh deep clone).
 */
export function normalizeConditionOperators(condition: unknown): void {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    return
  }
  const group = condition as ConditionGroup
  const children = group.$and ?? group.$or
  if (Array.isArray(children)) {
    children.forEach(normalizeConditionOperators)
    return
  }
  const item = condition as { op?: unknown }
  if (typeof item.op === 'string') {
    item.op = normalizeOperator(item.op)
  }
}

const VALUE_RULES: Array<{ ops: ReadonlySet<string>; valid: (value: unknown) => boolean; requirement: string }> = [
  {
    ops: ARRAY_OPS,
    valid: (value) => Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number'),
    requirement: 'an array of strings or numbers',
  },
  {
    ops: BETWEEN_OPS,
    valid: (value) => Array.isArray(value) && value.length === 2 && isRangeValue(value[0]) && isRangeValue(value[1]),
    requirement: 'a tuple/array of two values [start, end], each being string|number|Date',
  },
  { ops: PATTERN_OPS, valid: (value) => typeof value === 'string', requirement: 'a string value' },
  { ops: COMPARISON_OPS, valid: isRangeValue, requirement: 'a comparable value (string|number|Date)' },
  { ops: BASIC_OPS, valid: isSimpleValue, requirement: 'a simple value (string|number|Date|boolean|null)' },
]

function validateOperatorValue(op: string, value: unknown, path: string): void {
  if (NULL_OPS.has(op)) {
    if (value !== undefined) {
      throw new Error(`${path}: ${op} does not accept a value`)
    }
    return
  }

  if (value === undefined) {
    throw new Error(`${path}: value is required for operator ${op}`)
  }

  for (const rule of VALUE_RULES) {
    if (rule.ops.has(op)) {
      if (!rule.valid(value)) {
        throw new Error(`${path}: ${op} requires ${rule.requirement}`)
      }
      return
    }
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  switch (typeof value) {
    case 'object':
      return 'an object'
    case 'function':
      return 'a function'
    case 'string':
      return `'${value}' (string)`
    default:
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- only primitives remain after the object/function branches
      return `'${String(value)}' (${typeof value})`
  }
}
