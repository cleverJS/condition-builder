import { ConditionBuilder } from './ConditionBuilder'
import { ConditionItem, SimpleValue, SimpleValueArray } from './interfaces/types'

export class FieldBuilder<TSchema = Record<string, any>> {
  constructor(
    private readonly parent: ConditionBuilder<TSchema>,
    private readonly field: string
  ) {}

  // Comparison operators
  public eq(value: SimpleValue): ConditionBuilder<TSchema> { return this.#createCondition('$eq', value) }
  public ne(value: SimpleValue): ConditionBuilder<TSchema> { return this.#createCondition('$ne', value) }
  public gt(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> { return this.#createCondition('$gt', value) }
  public gte(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> { return this.#createCondition('$gte', value) }
  public lt(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> { return this.#createCondition('$lt', value) }
  public lte(value: Exclude<SimpleValue, boolean | null>): ConditionBuilder<TSchema> { return this.#createCondition('$lte', value) }

  // Pattern matching operators
  public like(value: string): ConditionBuilder<TSchema> { return this.#createCondition('$like', value) }
  public notLike(value: string): ConditionBuilder<TSchema> { return this.#createCondition('$notlike', value) }
  public ilike(value: string): ConditionBuilder<TSchema> { return this.#createCondition('$ilike', value) }

  // Array operators
  public in(values: SimpleValueArray): ConditionBuilder<TSchema> { return this.#createCondition('$in', values) }
  public notIn(values: SimpleValueArray): ConditionBuilder<TSchema> { return this.#createCondition('$notin', values) }

  // Range operators
  public between(start: string | number | Date, end: string | number | Date): ConditionBuilder<TSchema> {
    return this.#createCondition('$between', [start, end])
  }

  public notBetween(start: string | number | Date, end: string | number | Date): ConditionBuilder<TSchema> {
    return this.#createCondition('$notbetween', [start, end])
  }

  // Null operators
  public isNull(): ConditionBuilder<TSchema> { return this.#createCondition('$isnull') }
  public isNotNull(): ConditionBuilder<TSchema> { return this.#createCondition('$notnull') }

  // Builder chain helper
  public and(): ConditionBuilder<TSchema> { return this.parent }

  #createCondition(op: string, value?: unknown): ConditionBuilder<TSchema> {
    this.#validateValue(op, value)
    const condition = { op, field: this.field, value } as ConditionItem
    return this.parent.addCondition(condition)
  }

  #validateValue(op: string, value?: unknown): void {
    if (op === '$isnull' || op === '$notnull') {
      if (value !== undefined) {
        throw new Error(`${op} does not accept a value`)
      }
      return
    }

    if (value === undefined) {
      throw new Error(`Value is required for operator ${op}`)
    }

    if (op === '$in' || op === '$notin') {
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string' || typeof v === 'number')) {
        throw new Error(`${op} requires an array of strings or numbers`)
      }
      return
    }

    if (op === '$between' || op === '$notbetween') {
      if (!Array.isArray(value)) {
        throw new Error(`${op} requires an array with two values [start, end]`)
      }
      const [start, end] = value
      if (value.length !== 2 || !this.#isValidRangeValue(start) || !this.#isValidRangeValue(end)) {
        throw new Error(`${op} requires a tuple/array of two values [start, end], each being string|number|Date`)
      }
      return
    }

    if (op === '$like' || op === '$notlike' || op === '$ilike') {
      if (typeof value !== 'string') {
        throw new Error(`${op} requires a string value`)
      }
      return
    }

    if (['$gt', '$gte', '$lt', '$lte'].includes(op)) {
      if (!this.#isValidComparisonValue(value)) {
        throw new Error(`${op} requires a comparable value (string|number|Date)`)
      }
      return
    }

    if (!this.#isValidSimpleValue(value)) {
      throw new Error(`${op} requires a simple value (string|number|Date|boolean|null)`)
    }
  }

  #isValidSimpleValue(value: unknown): value is SimpleValue {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date
  }

  #isValidComparisonValue(value: unknown): value is Exclude<SimpleValue, boolean | null> {
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
  }

  #isValidRangeValue(value: unknown): value is string | number | Date {
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
  }
}
