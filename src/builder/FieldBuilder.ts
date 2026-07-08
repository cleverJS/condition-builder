import { ARRAY_OPS, BETWEEN_OPS, COMPARISON_OPS, isRangeValue, isSimpleValue, NULL_OPS, PATTERN_OPS } from '../utils'

import { ConditionBuilder } from './ConditionBuilder'
import { ConditionItem, Operator, Range, SimpleValue, SimpleValueArray } from './interfaces/types'

export class FieldBuilder<TSchema = Record<string, any>> {
  readonly #parent: ConditionBuilder<TSchema>
  readonly #field: string

  public constructor(parent: ConditionBuilder<TSchema>, field: string) {
    if (typeof field !== 'string' || field.trim().length === 0) {
      throw new Error('Field name must be a non-empty string')
    }
    this.#parent = parent
    this.#field = field
  }

  // Comparison operators
  public eq(value: SimpleValue): ConditionBuilder<TSchema> {
    return this.#createCondition('$eq', value)
  }
  public ne(value: SimpleValue): ConditionBuilder<TSchema> {
    return this.#createCondition('$ne', value)
  }
  public gt(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> {
    return this.#createCondition('$gt', value)
  }
  public gte(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> {
    return this.#createCondition('$gte', value)
  }
  public lt(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> {
    return this.#createCondition('$lt', value)
  }
  public lte(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> {
    return this.#createCondition('$lte', value)
  }

  // Pattern matching operators
  public like(value: string): ConditionBuilder<TSchema> {
    return this.#createCondition('$like', value)
  }
  public notLike(value: string): ConditionBuilder<TSchema> {
    return this.#createCondition('$notlike', value)
  }
  public ilike(value: string): ConditionBuilder<TSchema> {
    return this.#createCondition('$ilike', value)
  }
  public notIlike(value: string): ConditionBuilder<TSchema> {
    return this.#createCondition('$notilike', value)
  }

  // Array operators
  public in(values: SimpleValueArray): ConditionBuilder<TSchema> {
    return this.#createCondition('$in', values)
  }
  public notIn(values: SimpleValueArray): ConditionBuilder<TSchema> {
    return this.#createCondition('$notin', values)
  }

  // Range operators
  public between(start: Range, end: Range): ConditionBuilder<TSchema> {
    return this.#createCondition('$between', [start, end])
  }

  public notBetween(start: Range, end: Range): ConditionBuilder<TSchema> {
    return this.#createCondition('$notbetween', [start, end])
  }

  // Null operators
  public isNull(): ConditionBuilder<TSchema> {
    return this.#createCondition('$isnull')
  }
  public isNotNull(): ConditionBuilder<TSchema> {
    return this.#createCondition('$notnull')
  }

  // Builder chain helper
  public and(): ConditionBuilder<TSchema> {
    return this.#parent
  }

  #createCondition(op: Operator, value?: unknown): ConditionBuilder<TSchema> {
    this.#validateValue(op, value)
    const condition = op === '$isnull' || op === '$notnull' ? { op, field: this.#field } : { op, field: this.#field, value }
    return this.#parent.addCondition(<ConditionItem>condition)
  }

  #validateValue(op: string, value?: unknown): void {
    if (NULL_OPS.has(op)) {
      return this.#validateNullOp(op, value)
    }

    if (value === undefined) {
      throw new Error(`Value is required for operator ${op}`)
    }

    if (ARRAY_OPS.has(op)) {
      return this.#validateArrayOp(op, value)
    }

    if (BETWEEN_OPS.has(op)) {
      return this.#validateBetweenOp(op, value)
    }

    if (PATTERN_OPS.has(op)) {
      return this.#validatePatternOp(op, value)
    }

    if (COMPARISON_OPS.has(op)) {
      return this.#validateComparisonOp(op, value)
    }

    if (!isSimpleValue(value)) {
      throw new Error(`${op} requires a simple value (string|number|Date|boolean|null)`)
    }
  }

  #validateNullOp(op: string, value?: unknown): void {
    if (value !== undefined) {
      throw new Error(`${op} does not accept a value`)
    }
  }

  #validateArrayOp(op: string, value: unknown): void {
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      throw new Error(`${op} requires an array of strings or numbers`)
    }
    if (value.length === 0) {
      throw new Error(`${op} requires a non-empty array`)
    }
  }

  #validateBetweenOp(op: string, value: unknown): void {
    if (!Array.isArray(value)) {
      throw new Error(`${op} requires an array with two values [start, end]`)
    }
    const range: unknown[] = value
    const [start, end] = range
    if (range.length !== 2 || !isRangeValue(start) || !isRangeValue(end)) {
      throw new Error(`${op} requires a tuple/array of two values [start, end], each being string|number|Date`)
    }
  }

  #validatePatternOp(op: string, value: unknown): void {
    if (typeof value !== 'string') {
      throw new Error(`${op} requires a string value`)
    }
  }

  #validateComparisonOp(op: string, value: unknown): void {
    if (!isRangeValue(value)) {
      throw new Error(`${op} requires a comparable value (string|number|Date)`)
    }
  }
}
