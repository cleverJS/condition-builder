import { ConditionBuilder } from './ConditionBuilder'
import { ConditionItem, Operator, Range, SimpleValue, SimpleValueArray } from './interfaces/types'

const NULL_OPS = new Set(['$isnull', '$notnull'])
const ARRAY_OPS = new Set(['$in', '$notin', '$nin'])
const BETWEEN_OPS = new Set(['$between', '$notbetween'])
const PATTERN_OPS = new Set(['$like', '$notlike', '$ilike'])
const COMPARISON_OPS = new Set(['$gt', '$gte', '$lt', '$lte'])

export class FieldBuilder<TSchema = Record<string, any>> {
  readonly #parent: ConditionBuilder<TSchema>
  readonly #field: string

  public constructor(parent: ConditionBuilder<TSchema>, field: string) {
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

    if (!this.#isValidSimpleValue(value)) {
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
    const [start, end] = value
    if (value.length !== 2 || !this.#isValidRangeValue(start) || !this.#isValidRangeValue(end)) {
      throw new Error(`${op} requires a tuple/array of two values [start, end], each being string|number|Date`)
    }
  }

  #validatePatternOp(op: string, value: unknown): void {
    if (typeof value !== 'string') {
      throw new Error(`${op} requires a string value`)
    }
  }

  #validateComparisonOp(op: string, value: unknown): void {
    if (!this.#isValidComparisonValue(value)) {
      throw new Error(`${op} requires a comparable value (string|number|Date)`)
    }
  }

  #isValidSimpleValue(value: unknown): value is SimpleValue {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date
  }

  #isValidComparisonValue(value: unknown): value is Exclude<SimpleValue, boolean | null> {
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
  }

  #isValidRangeValue(value: unknown): value is Range {
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
  }
}
