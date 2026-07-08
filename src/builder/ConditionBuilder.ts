import {
  deepClone,
  isConditionGroup,
  isRangeValue,
  KNOWN_OPERATORS,
  normalizeConditionOperators,
  normalizeOperator,
  pruneEmptyGroups,
  validateCondition,
  validateConditionItem,
} from '../utils'

import { FieldBuilder } from './FieldBuilder'
import { WhereDescriptor } from './interfaces/descriptors'
import {
  ArrayOperator,
  BasicOperator,
  BetweenOperator,
  BetweenValue,
  ComparisonOperator,
  ComparisonValue,
  Condition,
  ConditionGroup,
  ConditionItem,
  NullOperator,
  PatternOperator,
  SimpleValue,
  SimpleValueArray,
} from './interfaces/types'

export class ConditionBuilder<TSchema = Record<string, any>> {
  static readonly #MAX_NESTING_DEPTH = 50

  readonly #root: ConditionGroup
  readonly #current: ConditionGroup[] = []

  public static get MAX_NESTING_DEPTH(): number {
    return ConditionBuilder.#MAX_NESTING_DEPTH
  }

  public constructor(initialCondition?: Condition) {
    if (initialCondition) {
      const cloned = deepClone(initialCondition)
      normalizeConditionOperators(cloned)
      validateCondition(cloned)
      this.#root = isConditionGroup(cloned) ? cloned : { $and: [cloned] }
    } else {
      this.#root = { $and: [] }
    }
    this.#current = [this.#root]
  }

  public static create<TSchema = Record<string, any>>(): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(obj: WhereDescriptor<TSchema>): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(field: keyof TSchema & string, op: BasicOperator, value: SimpleValue): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(
    field: keyof TSchema & string,
    op: ComparisonOperator,
    value: ComparisonValue
  ): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(field: keyof TSchema & string, op: PatternOperator, value: string): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(
    field: keyof TSchema & string,
    op: ArrayOperator,
    value: SimpleValueArray
  ): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(
    field: keyof TSchema & string,
    op: BetweenOperator,
    value: BetweenValue
  ): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(field: keyof TSchema & string, op: NullOperator, value?: boolean): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(arg?: unknown, op?: string, value?: unknown): ConditionBuilder<TSchema> {
    const builder = new ConditionBuilder<TSchema>()

    if (arg === undefined) {
      return builder
    }

    if (ConditionBuilder.#isWhereDescriptor(arg)) {
      ConditionBuilder.#assertNotConditionShape(arg)
      return builder.#handleWhereDescriptor(deepClone(arg) as WhereDescriptor<TSchema>)
    }

    if (typeof arg === 'string' && arg.length > 0 && op !== undefined) {
      return builder.#handleOperatorCondition(arg, op, deepClone(value))
    }

    throw new Error('Invalid arguments for ConditionBuilder.create(): expected no arguments, a descriptor object, or (field, operator, value)')
  }

  /**
   * Create a ConditionBuilder from an existing ConditionGroup or ConditionItem.
   * The condition is cloned, operators are normalized to canonical form and the
   * whole tree is validated — malformed input throws here instead of failing
   * deep inside an adapter at serialization time.
   */
  public static from<TSchema = Record<string, any>>(condition: Condition): ConditionBuilder<TSchema> {
    return new ConditionBuilder<TSchema>(condition)
  }

  public where(field: keyof TSchema & string): FieldBuilder<TSchema>
  public where(obj: WhereDescriptor<TSchema>): ConditionBuilder<TSchema>
  public where(field: keyof TSchema & string, op: BasicOperator, value: SimpleValue): ConditionBuilder<TSchema>
  public where(field: keyof TSchema & string, op: ComparisonOperator, value: ComparisonValue): ConditionBuilder<TSchema>
  public where(field: keyof TSchema & string, op: PatternOperator, value: string): ConditionBuilder<TSchema>
  public where(field: keyof TSchema & string, op: ArrayOperator, value: SimpleValueArray): ConditionBuilder<TSchema>
  public where(field: keyof TSchema & string, op: BetweenOperator, value: BetweenValue): ConditionBuilder<TSchema>
  public where(field: keyof TSchema & string, op: NullOperator, value?: boolean): ConditionBuilder<TSchema>
  public where(
    arg: (keyof TSchema & string) | WhereDescriptor<TSchema>,
    op?: string,
    value?: unknown
  ): ConditionBuilder<TSchema> | FieldBuilder<TSchema> {
    if (ConditionBuilder.#isWhereDescriptor(arg)) {
      ConditionBuilder.#assertNotConditionShape(arg)
      return this.#handleWhereDescriptor(deepClone(arg))
    }

    if (op === undefined) {
      return new FieldBuilder<TSchema>(this, arg)
    }

    return this.#handleOperatorCondition(arg, op, deepClone(value))
  }

  public orGroup(callback: (builder: ConditionBuilder<TSchema>) => void): ConditionBuilder<TSchema> {
    return this.#createGroup('or', callback)
  }

  public andGroup(callback: (builder: ConditionBuilder<TSchema>) => void): ConditionBuilder<TSchema> {
    return this.#createGroup('and', callback)
  }

  public addCondition(condition: ConditionItem): ConditionBuilder<TSchema> {
    const cloned = deepClone(condition)
    normalizeConditionOperators(cloned)
    validateConditionItem(cloned)
    const group = this.#getCurrentGroup()
    const key = group.$and ? '$and' : '$or'
    group[key]!.push(cloned)
    return this
  }

  /**
   * Produce the final Condition. Empty groups (e.g. an orGroup() whose callback
   * added nothing) are pruned — they are a no-op by contract — and single-item
   * groups are unwrapped. An empty builder produces { $and: [] }.
   */
  public build(): Condition {
    const pruned = pruneEmptyGroups(this.#root)
    if (!pruned) {
      return { $and: [] }
    }
    return this.#unwrapSingleCondition(deepClone(pruned))
  }

  /**
   * Unwrap single conditions from unnecessary $and or $or groups
   * For example: { $and: [{ field: 'name', op: '$eq', value: 'John' }] }
   * becomes: { field: 'name', op: '$eq', value: 'John' }
   */
  #unwrapSingleCondition(group: Condition): Condition {
    // If it's not a group, return as is
    if (!('$and' in group) && !('$or' in group)) {
      return group
    }

    const key = '$and' in group ? '$and' : '$or'
    const conditions = group[key]

    // If there's exactly one condition, unwrap it
    if (conditions && conditions.length === 1) {
      const singleCondition = conditions[0]
      // If the single condition is also a group, recursively unwrap it
      if ('$and' in singleCondition || '$or' in singleCondition) {
        return this.#unwrapSingleCondition(singleCondition)
      }
      // Otherwise return the single condition item
      return singleCondition
    }

    // For multiple conditions, recursively unwrap nested groups
    if (conditions && conditions.length > 1) {
      group[key] = conditions.map((condition) => {
        if ('$and' in condition || '$or' in condition) {
          return this.#unwrapSingleCondition(condition)
        }
        return condition
      })
    }

    return group
  }

  static #isWhereDescriptor(arg: unknown): arg is WhereDescriptor {
    return typeof arg === 'object' && arg !== null && !Array.isArray(arg) && !(arg instanceof Date)
  }

  static #assertNotConditionShape(arg: object): void {
    if ('$and' in arg || '$or' in arg || ('field' in arg && 'op' in arg)) {
      throw new Error(
        'This object looks like a built Condition, not a field descriptor. ' +
          'Use ConditionBuilder.from(condition) to start from an existing condition, or addCondition() to append a raw condition item.'
      )
    }
  }

  #getCurrentGroup(): ConditionGroup {
    return this.#current[this.#current.length - 1]
  }

  #isSimpleValue(value: unknown): value is Date | string | number | boolean | null {
    return value === null || typeof value !== 'object' || value instanceof Date
  }

  #handleWhereDescriptor(descriptor: WhereDescriptor<TSchema>): ConditionBuilder<TSchema> {
    Object.entries(descriptor).forEach(([key, value]) => {
      if (this.#isSimpleValue(value)) {
        new FieldBuilder<TSchema>(this, key).eq(value)
        return
      }

      if (Array.isArray(value)) {
        new FieldBuilder<TSchema>(this, key).in(value)
        return
      }

      this.#handleComplexDescriptorValue(key, value as Record<string, unknown>)
    })

    return this
  }

  #handleOperatorCondition(field: string, op: string, value: unknown): ConditionBuilder<TSchema> {
    const canonical = normalizeOperator(op)
    if (!KNOWN_OPERATORS.has(canonical)) {
      throw new Error(`Unknown operator: ${op}`)
    }
    return this.#applyOperator(new FieldBuilder<TSchema>(this, field), canonical, value)
  }

  #applyOperator(fb: FieldBuilder<TSchema>, op: string, value: unknown): ConditionBuilder<TSchema> {
    switch (op) {
      case '$eq':
        return fb.eq(value as SimpleValue)
      case '$ne':
        return fb.ne(value as SimpleValue)
      case '$gt':
        return fb.gt(value as ComparisonValue)
      case '$gte':
        return fb.gte(value as ComparisonValue)
      case '$lt':
        return fb.lt(value as ComparisonValue)
      case '$lte':
        return fb.lte(value as ComparisonValue)
      case '$like':
        return fb.like(value as string)
      case '$notlike':
        return fb.notLike(value as string)
      case '$ilike':
        return fb.ilike(value as string)
      case '$notilike':
        return fb.notIlike(value as string)
      case '$in':
        return fb.in(value as SimpleValueArray)
      case '$nin':
      case '$notin':
        return fb.notIn(value as SimpleValueArray)
      case '$between':
      case '$notbetween':
        return this.#applyBetween(fb, op, value)
      case '$isnull':
      case '$notnull':
        return this.#applyNullOperator(fb, op, value)
      default:
        throw new Error(`Unknown operator: ${op}`)
    }
  }

  #applyBetween(fb: FieldBuilder<TSchema>, op: '$between' | '$notbetween', value: unknown): ConditionBuilder<TSchema> {
    if (!Array.isArray(value) || value.length !== 2 || !isRangeValue(value[0]) || !isRangeValue(value[1])) {
      throw new Error(`${op} requires a tuple/array of two values [start, end], each being string|number|Date`)
    }
    return op === '$between' ? fb.between(value[0], value[1]) : fb.notBetween(value[0], value[1])
  }

  #applyNullOperator(fb: FieldBuilder<TSchema>, op: '$isnull' | '$notnull', value: unknown): ConditionBuilder<TSchema> {
    if (value !== undefined && typeof value !== 'boolean') {
      throw new Error(`${op} accepts only a boolean or no value`)
    }
    // { $isnull: false } means "is not null" and vice versa
    const wantNull = op === '$isnull' ? value !== false : value === false
    return wantNull ? fb.isNull() : fb.isNotNull()
  }

  #handleComplexDescriptorValue(key: string, value: Record<string, unknown>): void {
    if ('op' in value) {
      this.#handleExplicitOperatorDescriptor(key, value)
      return
    }

    const entries = Object.entries(value)
    if (entries.length === 0) {
      throw new Error(`Empty object is not a valid condition for field '${key}'`)
    }

    // Multiple operator keys are combined with AND: { age: { $gte: 18, $lte: 65 } }
    for (const [opKey, opValue] of entries) {
      const canonical = normalizeOperator(opKey)
      if (!KNOWN_OPERATORS.has(canonical)) {
        throw new Error(`Invalid operator key '${opKey}' for field '${key}'`)
      }
      this.#handleOperatorCondition(key, canonical, opValue)
    }
  }

  #handleExplicitOperatorDescriptor(key: string, value: Record<string, unknown>): void {
    if (typeof value.op !== 'string') {
      throw new Error(`Operator must be a string in explicit operator format for field '${key}'`)
    }
    const canonical = normalizeOperator(value.op)
    // Null operators are the only ones that work without a value
    if (canonical !== '$isnull' && canonical !== '$notnull' && (!('value' in value) || value.value === undefined)) {
      throw new Error(`Missing 'value' property in explicit operator format for field '${key}'`)
    }
    this.#handleOperatorCondition(key, canonical, value.value)
  }

  #createGroup(type: 'and' | 'or', callback: (builder: ConditionBuilder<TSchema>) => void): ConditionBuilder<TSchema> {
    if (this.#current.length >= ConditionBuilder.#MAX_NESTING_DEPTH) {
      throw new Error(`Maximum nesting depth of ${ConditionBuilder.#MAX_NESTING_DEPTH} exceeded`)
    }

    const group: ConditionGroup = type === 'and' ? { $and: [] } : { $or: [] }
    const currentGroup = this.#getCurrentGroup()
    const key = currentGroup.$and ? '$and' : '$or'
    currentGroup[key]!.push(group)
    this.#current.push(group)

    try {
      callback(this)
    } finally {
      this.#current.pop()
    }

    return this
  }
}
