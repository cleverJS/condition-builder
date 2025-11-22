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

  public constructor(initialCondition?: ConditionGroup | ConditionItem) {
    if (initialCondition) {
      // If it's a ConditionGroup, use it as root
      if ('$and' in initialCondition || '$or' in initialCondition) {
        this.#root = this.#deepClone(initialCondition as ConditionGroup)
      } else {
        // If it's a ConditionItem, wrap it in an $and group
        this.#root = { $and: [this.#deepClone(initialCondition as ConditionItem)] }
      }
    } else {
      this.#root = { $and: [] }
    }
    this.#current = [this.#root]
  }

  public static create<TSchema = Record<string, any>>(): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(field: keyof TSchema & string, op: Operator, value?: unknown): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(obj: WhereDescriptor<TSchema>): ConditionBuilder<TSchema>
  // public static create<TSchema = Record<string, any>>(condition: ConditionGroup | ConditionItem): ConditionBuilder<TSchema>
  public static create<TSchema = Record<string, any>>(arg?: any, op?: Operator, value?: unknown): ConditionBuilder<TSchema> {
    // potential bug if it would be WhereDescriptor with field and op
    // if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
    //   if ('$and' in arg || '$or' in arg || ('field' in arg && 'op' in arg)) {
    //     return new ConditionBuilder<TSchema>(arg as ConditionGroup | ConditionItem)
    //   }
    // }

    const builder = new ConditionBuilder<TSchema>()

    if (ConditionBuilder.#isWhereDescriptor(arg)) {
      return builder.where(builder.#deepClone(arg))
    }

    if (arg && op !== undefined) {
      return builder.where(arg as keyof TSchema & string, op, builder.#deepClone(value))
    }

    return builder
  }

  /**
   * Create a ConditionBuilder from an existing ConditionGroup or ConditionItem
   * This is useful for deserializers that want to convert their format to conditions first,
   * then provide a builder for further modifications
   */
  public static from<TSchema = Record<string, any>>(condition: ConditionGroup | ConditionItem): ConditionBuilder<TSchema> {
    return new ConditionBuilder<Record<string, any>>(condition)
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

  /**
   * Add a ConditionGroup or ConditionItem directly to the current group
   * This is useful for adapters that need to add pre-built conditions
   */
  public add(condition: ConditionGroup | ConditionItem): ConditionBuilder<TSchema> {
    const group = this.#getCurrentGroup()
    const key = group.$and ? '$and' : '$or'
    group[key]!.push(this.#deepClone(condition))
    return this
  }

  public build(): ConditionGroup | ConditionItem {
    const cloned = this.#deepClone(this.#root)
    return this.#unwrapSingleCondition(cloned)
  }

  /**
   * Unwrap single conditions from unnecessary $and or $or groups
   * For example: { $and: [{ field: 'name', op: '$eq', value: 'John' }] }
   * becomes: { field: 'name', op: '$eq', value: 'John' }
   */
  #unwrapSingleCondition(group: ConditionGroup | ConditionItem): ConditionGroup | ConditionItem {
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
      }) as Array<ConditionGroup | ConditionItem>
    }

    return group
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
