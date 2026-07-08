import { describe, expect, it } from 'vitest'

import { Condition, ConditionBuilder, mapFieldName } from '../src'

/**
 * Validation at the API boundary: ConditionBuilder.from()/constructor accept
 * arbitrary JSON (HTTP bodies, stored filters), so malformed input must fail
 * here with a pointed message — not deep inside an adapter at serialize time.
 */
describe('ConditionBuilder.from() validation', () => {
  it('should throw on an unknown operator and name the field', () => {
    expect(() => ConditionBuilder.from({ field: 'a', op: '$foo', value: 1 } as unknown as Condition)).toThrow(/field 'a'.*unknown operator/)
  })

  it('should throw when a group contains both $and and $or', () => {
    const condition = {
      $and: [{ field: 'a', op: '$eq', value: 1 }],
      $or: [{ field: 'b', op: '$eq', value: 2 }],
    }
    expect(() => ConditionBuilder.from(condition as Condition)).toThrow(/not both/)
  })

  it('should throw on an empty object', () => {
    expect(() => ConditionBuilder.from({} as Condition)).toThrow(/'field' must be a non-empty string/)
  })

  it('should throw when value is missing for an operator that requires one', () => {
    expect(() => ConditionBuilder.from({ field: 'a', op: '$eq' } as unknown as Condition)).toThrow(/value is required/)
  })

  it('should throw when $in receives non-scalar entries', () => {
    expect(() => ConditionBuilder.from({ field: 'a', op: '$in', value: [{}] } as unknown as Condition)).toThrow(/array of strings or numbers/)
  })

  it('should throw with a path when a nested condition is malformed', () => {
    const condition = {
      $and: [
        { field: 'ok', op: '$eq', value: 1 },
        { field: 'bad', op: '$gt', value: null },
      ],
    }
    expect(() => ConditionBuilder.from(condition as unknown as Condition)).toThrow(/\$and\[1\].*\$gt/)
  })

  it('should normalize uppercase and $-less operators to canonical form', () => {
    expect(ConditionBuilder.from({ field: 'a', op: '$EQ', value: 1 } as unknown as Condition).build()).toEqual({ field: 'a', op: '$eq', value: 1 })
    expect(ConditionBuilder.from({ field: 'a', op: 'eq', value: 1 } as unknown as Condition).build()).toEqual({ field: 'a', op: '$eq', value: 1 })
  })

  it('should accept an empty $in array (adapters serialize it as match-nothing)', () => {
    expect(ConditionBuilder.from({ field: 'a', op: '$in', value: [] }).build()).toEqual({ field: 'a', op: '$in', value: [] })
  })

  it('should validate raw items passed to addCondition()', () => {
    expect(() => ConditionBuilder.create().addCondition({ field: '', op: '$eq', value: 1 })).toThrow(/'field' must be a non-empty string/)
    expect(() =>
      ConditionBuilder.create().addCondition({ field: 'a', op: '$nope' } as unknown as Parameters<ConditionBuilder['addCondition']>[0])
    ).toThrow(/unknown operator/)
  })
})

describe('Descriptor semantics', () => {
  it('should combine multiple operators on one field with AND', () => {
    expect(ConditionBuilder.create({ age: { $gte: 18, $lte: 65 } }).build()).toEqual({
      $and: [
        { field: 'age', op: '$gte', value: 18 },
        { field: 'age', op: '$lte', value: 65 },
      ],
    })
  })

  it('should throw on an invalid operator key even when other keys are valid', () => {
    expect(() => ConditionBuilder.create({ age: { $gte: 18, bogus: 1 } as never })).toThrow(/Invalid operator key 'bogus'/)
  })

  it('should support explicit { op: $isnull } without a value', () => {
    expect(ConditionBuilder.create({ deletedAt: { op: '$isnull' } }).build()).toEqual({ field: 'deletedAt', op: '$isnull' })
  })

  it('should invert null operators when given false', () => {
    expect(ConditionBuilder.create({ a: { $isnull: false } }).build()).toEqual({ field: 'a', op: '$notnull' })
    expect(ConditionBuilder.create({ a: { $notnull: false } }).build()).toEqual({ field: 'a', op: '$isnull' })
  })

  it('should keep { field: null } as $eq null (adapters serialize it as IS NULL)', () => {
    expect(ConditionBuilder.create({ deletedAt: null }).build()).toEqual({ field: 'deletedAt', op: '$eq', value: null })
  })

  it('should reject a built Condition passed where a descriptor is expected', () => {
    const built = ConditionBuilder.create('name', '$eq', 'John').build()
    expect(() => ConditionBuilder.create(built as never)).toThrow(/looks like a built Condition/)
    expect(() => ConditionBuilder.create().where({ $or: [] } as never)).toThrow(/looks like a built Condition/)
  })

  it('should reject create() with a field but no operator instead of silently ignoring it', () => {
    expect(() => ConditionBuilder.create('name' as never)).toThrow(/Invalid arguments/)
    expect(() => ConditionBuilder.create('' as never, '$eq' as never, 'x' as never)).toThrow(/Invalid arguments/)
  })

  it('should reject an empty field name in where()', () => {
    expect(() => ConditionBuilder.create().where('')).toThrow(/non-empty string/)
  })

  it('should support null operators through where(field, op)', () => {
    expect(ConditionBuilder.create().where('a', '$isnull').build()).toEqual({ field: 'a', op: '$isnull' })
  })
})

describe('mapFieldName against hostile field names', () => {
  it('should not resolve field names through the prototype chain', () => {
    // Regression: 'constructor' resolved to the Object constructor function
    // and the field name silently became a function
    for (const hostile of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(mapFieldName(hostile, { fieldMapping: { name: 'user_name' } })).toBe(hostile)
    }
  })

  it('should apply an explicitly configured mapping even for reserved-looking names', () => {
    expect(mapFieldName('constructor', { fieldMapping: { constructor: 'ctor_col' } })).toBe('ctor_col')
  })

  it('should ignore non-string mapping values', () => {
    expect(mapFieldName('a', { fieldMapping: { a: 42 as unknown as string } })).toBe('a')
  })
})
