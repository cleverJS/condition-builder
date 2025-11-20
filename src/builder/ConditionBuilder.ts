import { WhereDescriptor } from './interfaces/descriptors'
import { FieldBuilder } from './FieldBuilder'
import { ConditionGroup, ConditionItem, Operator, SimpleValue } from './interfaces/types'

export class ConditionBuilder<TSchema = Record<string, any>> {
  readonly #root: ConditionGroup
  readonly #current: ConditionGroup[] = []

  static readonly #OPERATOR_MAPPINGS = {
    BASIC: {
      $eq: { method: 'eq' },
      $ne: { method: 'ne' },
      $gt: { method: 'gt' },
      $gte: { method: 'gte' },
      $lt: { method: 'lt' },
      $lte: { method: 'lte' },
    },
    PATTERN: {
      $like: { method: 'like' },
      $ilike: { method: 'ilike' },
      $notlike: { method: 'notLike' },
    },
    ARRAY: {
      $in: { method: 'in' },
      $nin: { method: 'notIn' },
      $notin: { method: 'notIn' },
      $between: { method: 'between' },
      $notbetween: { method: 'notBetween' },
    },
    NULL: {
      $isnull: { method: 'isNull' },
      $notnull: { method: 'isNotNull' },
    },
  } as const

  public constructor() {
    this.#root = { $and: [] }
    this.#current = [this.#root]
  }

  public static create<TSchema = Record<string, any>>(): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(field: keyof TSchema & string, op: Operator, value?: unknown): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(obj: WhereDescriptor<TSchema>): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(arg?: string | WhereDescriptor<TSchema>, op?: Operator, value?: unknown): ConditionBuilder<TSchema> {
    const builder = new ConditionBuilder<TSchema>()

    if (ConditionBuilder.#isWhereDescriptor(arg)) {
      return builder.where(builder.#deepClone(arg))
    }

    if (arg && op !== undefined) {
      return builder.where(arg as keyof TSchema & string, op, builder.#deepClone(value))
    }

    return builder
  }

  public where(field: keyof TSchema & string): FieldBuilder<TSchema>
  public where(field: keyof TSchema & string, op: Operator, value?: unknown): ConditionBuilder<TSchema>
  public where(obj: WhereDescriptor<TSchema>): ConditionBuilder<TSchema>
  public where(arg: (keyof TSchema & string) | WhereDescriptor<TSchema>, op?: Operator, value?: unknown): ConditionBuilder<TSchema> | FieldBuilder<TSchema> {
    if (ConditionBuilder.#isWhereDescriptor(arg)) {
      return this.#handleWhereDescriptor(this.#deepClone(arg))
    }

    if (op === undefined) {
      return new FieldBuilder<TSchema>(this, arg as string)
    }

    return this.#handleOperatorCondition(arg as string, op, this.#deepClone(value))
  }

  public orGroup(callback: (builder: ConditionBuilder<TSchema>) => void): ConditionBuilder<TSchema> {
    return this.#createGroup('or', callback)
  }

  public andGroup(callback: (builder: ConditionBuilder<TSchema>) => void): ConditionBuilder<TSchema> {
    return this.#createGroup('and', callback)
  }

  public addCondition(condition: ConditionItem): ConditionBuilder<TSchema> {
    const group = this.#getCurrentGroup()
    const key = group.$and ? '$and' : '$or'
    group[key]!.push(this.#deepClone(condition))
    return this
  }

  public build(): ConditionGroup {
    return this.#deepClone(this.#root)
  }

  static #isWhereDescriptor(arg: unknown): arg is WhereDescriptor {
    return typeof arg === 'object' && arg !== null && !Array.isArray(arg)
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

  #isValidOperatorKey(key: string): boolean {
    const allOperators = Object.values(ConditionBuilder.#OPERATOR_MAPPINGS).reduce((acc, group) => [...acc, ...Object.keys(group)], [] as string[])
    return allOperators.includes(key) || key === 'op'
  }

  #handleOperatorCondition(field: string, op: string, value: unknown): ConditionBuilder<TSchema> {
    const fb = new FieldBuilder<TSchema>(this, field)
    const mapping = this.#getMappedOperator(op)

    if (!mapping) {
      if (Array.isArray(value)) {
        if (value.length === 2) {
          const [start, end] = value
          if (this.#isDateOrNumberOrString(start) && this.#isDateOrNumberOrString(end)) {
            return fb.between(start, end)
          }
        }
        if (this.#isSimpleValueArray(value)) {
          return fb.in(value)
        }
      }

      // Default to equals if no mapping found
      return fb.eq(value as SimpleValue)
    }

    const method = mapping.method
    if (typeof fb[method] === 'function') {
      // Special case for between/notBetween since they expect two arguments
      if ((op === '$between' || op === '$notbetween') && Array.isArray(value)) {
        const [start, end] = value
        if (this.#isDateOrNumberOrString(start) && this.#isDateOrNumberOrString(end)) {
          return (fb[method] as Function).call(fb, start, end)
        }
      }
      return (fb[method] as Function).call(fb, value)
    }

    throw new Error(`Method ${method} not found on FieldBuilder`)
  }

  #handleComplexDescriptorValue(key: string, value: Record<string, unknown>): void {
    if (this.#isExplicitOperator(value)) {
      if (!('value' in value) || value.value === undefined) {
        throw new Error(`Missing 'value' property in explicit operator format for field '${key}'`)
      }
      // For $between operator, ensure the value is properly formatted
      if ((value.op === '$between' || value.op === '$notbetween') && Array.isArray(value.value)) {
        const [start, end] = value.value
        if (this.#isDateOrNumberOrString(start) && this.#isDateOrNumberOrString(end)) {
          this.where(key as keyof TSchema & string, value.op as Operator, [start, end])
          return
        }
      }
      this.where(key as keyof TSchema & string, value.op as Operator, value.value)
      return
    }

    if (Object.keys(value).length === 0) {
      throw new Error(`Empty object is not a valid condition for field '${key}'`)
    }

    const [[opKey, opValue]] = Object.entries(value)
    if (!this.#isValidOperatorKey(opKey)) {
      throw new Error(`Invalid operator key '${opKey}' for field '${key}'`)
    }

    // For $between operator in shorthand form, ensure the value is properly formatted
    if ((opKey === '$between' || opKey === '$notbetween') && Array.isArray(opValue)) {
      const [start, end] = opValue
      if (this.#isDateOrNumberOrString(start) && this.#isDateOrNumberOrString(end)) {
        this.where(key as keyof TSchema & string, opKey as Operator, [start, end])
        return
      }
    }

    this.where(key as keyof TSchema & string, opKey as Operator, opValue)
  }

  #isExplicitOperator(value: Record<string, unknown>): boolean {
    return 'op' in value
  }

  #getMappedOperator(op: string): { method: string } | undefined {
    const opKey = op.startsWith('$') ? op : `$${op.toLowerCase()}`
    const allMappings = Object.values(ConditionBuilder.#OPERATOR_MAPPINGS).reduce((acc, map) => ({ ...acc, ...map }), {})
    return allMappings[opKey]
  }

  #isDateOrNumberOrString(value: unknown): value is string | number | Date {
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date
  }

  #isSimpleValueArray(value: unknown[]): value is (string | number)[] {
    return value.every((v) => typeof v === 'string' || typeof v === 'number')
  }

  #createGroup(type: 'and' | 'or', callback: (builder: ConditionBuilder<TSchema>) => void): ConditionBuilder<TSchema> {
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

  #deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.#deepClone(item)) as unknown as T
    }

    if (obj instanceof Date) {
      return new Date(obj) as unknown as T
    }

    const cloned = {} as T
    Object.entries(obj).forEach(([key, value]) => {
      cloned[key as keyof T] = this.#deepClone(value)
    })

    return cloned
  }
}
