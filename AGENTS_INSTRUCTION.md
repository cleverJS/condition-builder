Condition Builder Usage Guide

This document is covers building conditions, using adapters, and creating custom adapters.

## What This Library Does

Builds JSON-serializable condition objects representing SQL WHERE clauses. ORM-agnostic — construct conditions once, serialize to Knex, MikroORM, or custom targets via adapters.

## Building Conditions

### Fluent API (primary pattern)

```typescript
import { ConditionBuilder } from '@cleverjs/condition-builder'

const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .where('age').gt(18)
  .where('tags').in(['vip', 'premium'])
  .where('score').between(50, 100)
  .where('deletedAt').isNull()
  .build()
```

All top-level `.where()` calls are combined with AND logic. Use `.orGroup()` for OR.

### Direct Operator Shorthand

```typescript
const condition = ConditionBuilder.create('status', '$eq', 'active').build()
// → { field: 'status', op: '$eq', value: 'active' }
```

### Object Descriptor Notation

Pass an object where keys are field names and values define operators:

```typescript
const condition = ConditionBuilder.create({
  status: 'active',               // simple value → $eq
  age: { $gt: 21 },               // operator shorthand
  tags: ['A', 'B'],               // array → $in
  search: { $like: '%term%' },    // pattern match
  range: { $between: [1, 10] },   // range
}).build()
```

Also works with `.where()`:

```typescript
const condition = ConditionBuilder.create()
  .where({ status: 'active', age: { $gte: 18 } })
  .where('name').like('%John%')
  .build()
```

### Resume from Existing Condition (`from()`)

Reconstruct a builder from a previously built or stored condition:

```typescript
const existing = { $and: [{ field: 'status', op: '$eq', value: 'active' }] }
const condition = ConditionBuilder.from(existing)
  .where('age').gt(18)
  .build()

// Also works with a single ConditionItem
const item = { field: 'name', op: '$eq', value: 'John' }
const condition2 = ConditionBuilder.from(item)
  .where('deletedAt').isNull()
  .build()
```

### Adding Raw Condition Items

```typescript
const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .addCondition({ field: 'role', op: '$in', value: ['admin', 'editor'] })
  .build()
```

### Typed Schema

Pass a type parameter for field name autocomplete and compile-time checking:

```typescript
interface UserSchema {
  name: string
  age: number
  email: string
  isActive: boolean
}

const condition = ConditionBuilder.create<UserSchema>()
  .where('name').eq('John')       // ✅ autocompleted
  .where('age').gt(21)            // ✅ autocompleted
  // .where('nam').eq('John')     // ❌ TypeScript error
  .build()
```

## Operators Quick Reference

| Category | Operator | FieldBuilder Method | Accepted Value Type |
|----------|----------|-------------------|-------------------|
| Basic | `$eq` | `.eq(value)` | `string \| number \| Date \| boolean \| null` |
| Basic | `$ne` | `.ne(value)` | `string \| number \| Date \| boolean \| null` |
| Comparison | `$gt` | `.gt(value)` | `string \| number \| Date` |
| Comparison | `$gte` | `.gte(value)` | `string \| number \| Date` |
| Comparison | `$lt` | `.lt(value)` | `string \| number \| Date` |
| Comparison | `$lte` | `.lte(value)` | `string \| number \| Date` |
| Pattern | `$like` | `.like(value)` | `string` |
| Pattern | `$ilike` | `.ilike(value)` | `string` |
| Pattern | `$notlike` | `.notLike(value)` | `string` |
| Pattern | `$notilike` | `.notIlike(value)` | `string` |
| Array | `$in` | `.in(values)` | `Array<string \| number>` |
| Array | `$notin` | `.notIn(values)` | `Array<string \| number>` |
| Range | `$between` | `.between(start, end)` | `string \| number \| Date` each |
| Range | `$notbetween` | `.notBetween(start, end)` | `string \| number \| Date` each |
| Null | `$isnull` | `.isNull()` | — |
| Null | `$notnull` | `.isNotNull()` | — |

`$nin` is an alias for `$notin`.

## Nested Groups (AND / OR)

Use `.andGroup()` and `.orGroup()` to create nested condition groups:

```typescript
const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .orGroup(g => g
    .where('role').eq('admin')
    .where('vip').eq(true)
  )
  .build()

// Output:
// {
//   $and: [
//     { field: 'status', op: '$eq', value: 'active' },
//     {
//       $or: [
//         { field: 'role', op: '$eq', value: 'admin' },
//         { field: 'vip', op: '$eq', value: true }
//       ]
//     }
//   ]
// }
```

Groups nest to any depth (max 50 levels):

```typescript
const condition = ConditionBuilder.create()
  .where('active').eq(true)
  .orGroup(outer => outer
    .andGroup(inner => inner
      .where('role').eq('admin')
      .where('department').in(['engineering', 'security'])
    )
    .andGroup(inner => inner
      .where('role').eq('manager')
      .where('level').gte(3)
    )
  )
  .build()
```

## Null Checks

`.isNull()` and `.isNotNull()` produce conditions **without a `value` property**:

```typescript
ConditionBuilder.create()
  .where('deletedAt').isNull()     // → { field: 'deletedAt', op: '$isnull' }
  .where('email').isNotNull()      // → { field: 'email', op: '$notnull' }
  .build()
```

**Important distinction:** `.eq(null)` produces `{ op: '$eq', value: null }`, while `.isNull()` produces `{ op: '$isnull' }`. Use `.isNull()` / `.isNotNull()` for SQL `IS NULL` / `IS NOT NULL` semantics.

## Built-in Adapters

### Knex Adapter (Serializer)

Converts a `Condition` to a function that applies WHERE clauses to a Knex QueryBuilder:

```typescript
import { ConditionBuilder, KnexConditionAdapter } from '@cleverjs/condition-builder'

const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .where('age').gt(18)
  .orGroup(g => g
    .where('role').eq('admin')
    .where('vip').eq(true)
  )
  .build()

const adapter = new KnexConditionAdapter()
const applyConditions = adapter.serialize(condition)
// applyConditions: (qb: Knex.QueryBuilder) => Knex.QueryBuilder

const results = await knex('users').modify(applyConditions)
```

### MikroORM Adapter (Serializer)

Converts a `Condition` to a MikroORM `FilterQuery<T>`:

```typescript
import { ConditionBuilder, MikroOrmConditionAdapter } from '@cleverjs/condition-builder'

const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .where('age').between(18, 65)
  .build()

const adapter = new MikroOrmConditionAdapter()
const where = adapter.serialize<User>(condition)

const users = await em.find(User, where)
```

MikroORM operator mapping notes:
- `$between` → `{ $gte: start, $lte: end }`
- `$notbetween` → `{ $or: [{ $lt: start }, { $gt: end }] }`
- `$notlike` → `{ $not: { $like: value } }`
- `$isnull` → `{ field: null }`

### Kendo Filter Adapter (Deserializer)

Converts Kendo UI DataSource filter objects into a `ConditionBuilder`:

```typescript
import { KendoFilterAdapter } from '@cleverjs/condition-builder'

const adapter = new KendoFilterAdapter()

// Simple filter
const builder = adapter.deserialize({
  field: 'name',
  operator: 'eq',
  value: 'John',
})
const condition = builder.build()

// Composite filter
const builder2 = adapter.deserialize({
  logic: 'and',
  filters: [
    { field: 'category', operator: 'eq', value: 'electronics' },
    {
      logic: 'or',
      filters: [
        { field: 'price', operator: 'lt', value: 100 },
        { field: 'onSale', operator: 'eq', value: true },
      ],
    },
  ],
})

// Continue building after deserialization
builder2.where('deletedAt').isNull()
const condition2 = builder2.build()
```

Kendo operator mapping:

| Kendo Operator | Condition Operator | Notes |
|---|---|---|
| `eq`, `neq` | `$eq`, `$ne` | `eq(null)` → `$isnull`, `neq(null)` → `$notnull` |
| `gt`, `gte`, `lt`, `lte` | `$gt`, `$gte`, `$lt`, `$lte` | |
| `in` | `$in` | |
| `contains` | `$ilike` | wraps value: `%value%` |
| `doesnotcontain` | `$notilike` | wraps value: `%value%` |
| `startswith` | `$ilike` | wraps value: `value%` |
| `endswith` | `$ilike` | wraps value: `%value` |
| `doesnotstartwith` | `$notilike` | wraps value: `value%` |
| `doesnotendwith` | `$notilike` | wraps value: `%value` |
| `isnull`, `isnotnull` | `$isnull`, `$notnull` | |
| `isempty`, `isnotempty` | `$eq ''`, `$ne ''` | |
| `isnullorempty` | `$or` group | `$isnull` OR `$eq ''` |
| `isnotnullorempty` | `$and` group | `$notnull` AND `$ne ''` |

Pattern values are automatically escaped (`%`, `_`, `\` characters).

## Field Mapping

All adapters support a `fieldMapping` option to rename fields during serialization or deserialization.

### Deserialization (external → internal)

```typescript
const adapter = new KendoFilterAdapter()

const condition = adapter.deserialize(kendoFilter, {
  fieldMapping: {
    user_id: 'userId',
    created_at: 'createdAt',
  },
}).build()
// Fields 'user_id' → 'userId', 'created_at' → 'createdAt'
```

### Serialization (internal → external)

```typescript
const condition = ConditionBuilder.create()
  .where('userId').eq(123)
  .where('createdAt').gt('2023-01-01')
  .build()

const adapter = new MikroOrmConditionAdapter()
const where = adapter.serialize(condition, {
  fieldMapping: {
    userId: 'user_id',
    createdAt: 'created_at',
  },
})
// Fields 'userId' → 'user_id', 'createdAt' → 'created_at'
```

### Round-Trip (deserialize → serialize)

```typescript
const kendoAdapter = new KendoFilterAdapter()
const mikroAdapter = new MikroOrmConditionAdapter()

// 1. Kendo filter → internal condition (remap API fields → internal)
const condition = kendoAdapter.deserialize(kendoFilter, {
  fieldMapping: { user_id: 'userId', email_address: 'emailAddress' },
}).build()

// 2. Internal condition → MikroORM query (remap internal → DB columns)
const where = mikroAdapter.serialize(condition, {
  fieldMapping: { userId: 'user_id', emailAddress: 'email_address' },
})
```

Unmapped fields pass through unchanged.

## Custom Adapters

Implement `IConditionSerializer` (condition → external format) and/or `IConditionDeserializer` (external format → condition).

### Serializer (Condition → Target Format)

```typescript
import type { Condition, IConditionSerializer, ISerializationOptions } from '@cleverjs/condition-builder'

class MySerializer implements IConditionSerializer<MyQueryFormat> {
  public serialize(condition: Condition, options?: ISerializationOptions): MyQueryFormat {
    // Walk the condition tree:
    // - ConditionItem: { field, op, value }
    // - ConditionGroup: { $and: Condition[] } or { $or: Condition[] }
    //
    // Apply options.fieldMapping to remap field names if provided.
    // Return your target format.
  }
}
```

### Deserializer (Source Format → ConditionBuilder)

```typescript
import type { IConditionDeserializer, IDeserializationOptions } from '@cleverjs/condition-builder'
import { ConditionBuilder } from '@cleverjs/condition-builder'

class MyDeserializer implements IConditionDeserializer<MyFilterFormat> {
  public deserialize(input: MyFilterFormat, options?: IDeserializationOptions): ConditionBuilder {
    const builder = ConditionBuilder.create()

    // Parse your input format and call builder methods:
    // - builder.where('field').eq(value)
    // - builder.orGroup(g => g.where(...).where(...))
    // - builder.addCondition({ field, op, value })
    //
    // Apply options.fieldMapping to remap field names if provided.

    return builder  // Return the builder (not .build()), so callers can continue chaining
  }
}
```

### Full Adapter (both directions)

```typescript
import type { IConditionAdapter } from '@cleverjs/condition-builder'

class MyAdapter implements IConditionAdapter<MyFormat> {
  public serialize(condition: Condition, options?: ISerializationOptions): MyFormat { /* ... */ }
  public deserialize(input: MyFormat, options?: IDeserializationOptions): ConditionBuilder { /* ... */ }
}
```

### Registering via Plugin

```typescript
import type { IAdapterPlugin } from '@cleverjs/condition-builder'

const myPlugin: IAdapterPlugin = {
  type: 'my-adapter',
  serializer: new MySerializer(),
  deserializer: new MyDeserializer(),
}

const registry = new ConditionAdapterRegistry()
registry.registerPlugin(myPlugin)
```

## Adapter Registry

`ConditionAdapterRegistry` manages adapter instances. Create instances directly (DI-friendly) or use the factory function:

```typescript
import {
  ConditionAdapterRegistry,
  createConditionAdapterRegistry,
  AdapterType,
  KnexConditionAdapter,
} from '@cleverjs/condition-builder'

// Constructor with plugins
const registry = new ConditionAdapterRegistry([
  { type: AdapterType.KNEX, serializer: new KnexConditionAdapter() },
])

// Or factory function
const registry2 = createConditionAdapterRegistry([
  { type: AdapterType.KNEX, serializer: new KnexConditionAdapter() },
])

// Or empty registry + manual registration
const registry3 = new ConditionAdapterRegistry()
registry3.register(AdapterType.KNEX, new KnexConditionAdapter())
registry3.register('custom', mySerializer, myDeserializer)

// Retrieve
const knexAdapter = registry.getSerializer(AdapterType.KNEX)
const kendoAdapter = registry.getDeserializer(AdapterType.KENDO)

// Query
registry.hasSerializer(AdapterType.KNEX)    // boolean
registry.hasDeserializer(AdapterType.KENDO)  // boolean
registry.getRegisteredTypes()                // string[]

// Cleanup
registry.unregister(AdapterType.KNEX)
registry.clear()
```

Predefined type constants: `AdapterType.KNEX`, `AdapterType.MIKROORM`, `AdapterType.KENDO`.

### NestJS Integration

```typescript
@Module({
  providers: [
    {
      provide: ConditionAdapterRegistry,
      useFactory: () =>
        new ConditionAdapterRegistry([
          { type: AdapterType.KNEX, serializer: new KnexConditionAdapter() },
          { type: AdapterType.KENDO, deserializer: new KendoFilterAdapter() },
        ]),
    },
  ],
  exports: [ConditionAdapterRegistry],
})
export class ConditionBuilderModule {}
```

## Type Imports

```typescript
// Core condition types
import type { Condition, ConditionGroup, ConditionItem } from '@cleverjs/condition-builder'

// Value types
import type { SimpleValue, ComparisonValue, BetweenValue, Range, SimpleValueArray } from '@cleverjs/condition-builder'

// Operator types
import type { Operator, BasicOperator, ComparisonOperator, PatternOperator, ArrayOperator, BetweenOperator, NullOperator } from '@cleverjs/condition-builder'

// Adapter interfaces (for custom adapters)
import type { IConditionSerializer, IConditionDeserializer, IConditionAdapter, IAdapterPlugin } from '@cleverjs/condition-builder'

// Descriptor type (for object notation)
import type { WhereDescriptor } from '@cleverjs/condition-builder'
```
