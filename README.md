# Condition Builder

A small, type-safe TypeScript library for building **ORM-agnostic**, portable, JSON-serializable condition
objects for queries and filters. Write your query logic once and use it with any database layer — Knex, MikroORM,
or your custom implementation.

## Key Features
- **ORM/Database Agnostic** — unified abstraction layer, write conditions once, use with any query builder or ORM
- **No Vendor Lock-In** — switch between Knex, MikroORM, or implement custom adapters
- **Type-Safe Operators** — all operators (`$eq`, `$gt`, `$like`, etc.) are strictly typed with their allowed value types
- **Typed Schema Support** — optional generic type parameter for field name autocomplete and type checking
- **Fluent Builder API** — chainable builder pattern for constructing condition trees
- **JSON Serializable** — store, transmit, and cache conditions; perfect for APIs, saved filters, and dynamic queries
- **Field Mapping** — rename fields during serialization/deserialization (e.g., camelCase to snake_case)
- **AND/OR Groups** — create nested condition groups with proper type inference
- **Built-in Adapters** — out-of-the-box support for Knex, Kysely, MikroORM, and Kendo UI filters

## Installation
```bash
npm install @cleverjs/condition-builder
# or
pnpm install @cleverjs/condition-builder
```

Peer dependencies (install only what you need):
```bash
# For Knex adapter
pnpm install knex

# For Kysely adapter
pnpm install kysely

# For MikroORM adapter
pnpm install @mikro-orm/core
```

## Quick Start

All top-level `.where()` calls are combined with AND logic. Use `.orGroup()` when you need OR.

### Fluent API
```typescript
import { ConditionBuilder } from '@cleverjs/condition-builder'

const condition = ConditionBuilder.create()
  .where('age').gt(21)
  .where('name').like('%John%')
  .where('tags').in(['A', 'B'])
  .where('range').between(1, 10)
  .build()
```

### Direct Operator Shorthand
```typescript
const condition = ConditionBuilder.create('status', '$eq', 'active').build()
// → { field: 'status', op: '$eq', value: 'active' }
```

### Object Notation
```typescript
const condition = ConditionBuilder.create()
  .where({
    status: 'active',               // simple value → $eq
    age: { $gt: 21 },               // typed operators
    tags: ['A', 'B'],               // array → $in
    search: { $like: '%term%' },    // pattern match
    range: { $between: [1, 10] },   // typed tuples
    salary: { $gte: 1000, $lte: 5000 }, // multiple operators on one field → AND
  })
  .build()
```

### Object Notation on Create
```typescript
const condition = ConditionBuilder.create({
  status: 'active',
  age: { $gt: 21 },
  tags: ['A', 'B'],
}).build()
```

### With Typed Schema
```typescript
interface UserSchema {
  name: string
  age: number
  email: string
  isActive: boolean
}

const condition = ConditionBuilder.create<UserSchema>()
  .where('name').eq('John')             // 'name' is autocompleted
  .where('age').gt(21)                  // 'age' is autocompleted
  .where('email').ilike('%@example.com')
  .build()

// TypeScript catches typos:
// .where('nam').eq('John')             // ❌ Error: 'nam' does not exist
```

### CB Shorthand Alias

`CB` is exported as a shorthand alias for `ConditionBuilder`:

```typescript
import { CB } from '@cleverjs/condition-builder'

const condition = CB.create()
  .where('status').eq('active')
  .build()
```

## API Reference

### ConditionBuilder

#### Static Methods

| Method | Description |
|--------|-------------|
| `create()` | Start a new empty builder |
| `create(field, op, value)` | Start with a single condition |
| `create(descriptor)` | Start with multiple conditions from an object |
| `from(condition)` | Create a builder from an existing `ConditionGroup` or `ConditionItem` |

#### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `where(field)` | `FieldBuilder` | Start a field chain for the given field |
| `where(field, op, value)` | `ConditionBuilder` | Add a condition directly |
| `where(descriptor)` | `ConditionBuilder` | Add multiple conditions from an object |
| `andGroup(callback)` | `ConditionBuilder` | Create a nested AND group |
| `orGroup(callback)` | `ConditionBuilder` | Create a nested OR group |
| `addCondition(item)` | `ConditionBuilder` | Add a raw `ConditionItem` directly |
| `build()` | `Condition` | Build the final JSON condition object |

**`ConditionBuilder.from()` example:**
```typescript
// Resume building from an existing condition (e.g., loaded from DB or API)
const existing = { $and: [{ field: 'status', op: '$eq', value: 'active' }] }
const builder = ConditionBuilder.from(existing)
builder.where('age').gt(18)

// Works with a single ConditionItem too
const item = { field: 'name', op: '$eq', value: 'John' }
const builder2 = ConditionBuilder.from(item)
builder2.where('deletedAt').isNull()
```

**`addCondition()` example:**
```typescript
// Useful for programmatically adding pre-built condition items
const builder = ConditionBuilder.create()
  .where('status').eq('active')
  .addCondition({ field: 'role', op: '$in', value: ['admin', 'editor'] })
  .build()
```

### FieldBuilder

Returned by `builder.where(field)`. Provides typed operator methods, all returning `ConditionBuilder` for chaining.

#### Comparison
| Method | Operator | Accepts |
|--------|----------|---------|
| `eq(value)` | `$eq` | `string \| number \| Date \| boolean \| null` |
| `ne(value)` | `$ne` | `string \| number \| Date \| boolean \| null` |
| `gt(value)` | `$gt` | `string \| number \| Date` |
| `gte(value)` | `$gte` | `string \| number \| Date` |
| `lt(value)` | `$lt` | `string \| number \| Date` |
| `lte(value)` | `$lte` | `string \| number \| Date` |

#### Pattern
| Method | Operator | Accepts |
|--------|----------|---------|
| `like(value)` | `$like` | `string` |
| `ilike(value)` | `$ilike` | `string` |
| `notLike(value)` | `$notlike` | `string` |
| `notIlike(value)` | `$notilike` | `string` |

#### Array
| Method | Operator | Accepts |
|--------|----------|---------|
| `in(values)` | `$in` | `Array<string \| number>` |
| `notIn(values)` | `$notin` | `Array<string \| number>` |

#### Range
| Method | Operator | Accepts |
|--------|----------|---------|
| `between(start, end)` | `$between` | `string \| number \| Date` each |
| `notBetween(start, end)` | `$notbetween` | `string \| number \| Date` each |

#### Null
| Method | Operator | Accepts |
|--------|----------|---------|
| `isNull()` | `$isnull` | — |
| `isNotNull()` | `$notnull` | — |

#### Chaining Helper
| Method | Returns | Description |
|--------|---------|-------------|
| `and()` | `ConditionBuilder` | Returns the parent builder (useful in single-expression chains) |

`and()` is useful when you have a `FieldBuilder` reference and want to return to the parent builder:
```typescript
const builder = ConditionBuilder.create()
const fieldBuilder = builder.where('name') // returns FieldBuilder

// Later, get back to the parent builder without applying an operator
fieldBuilder.and().where('age').gt(18)
```

### Operators

All operators are prefixed with `$` and strictly typed:

| Category | Operators | Value Type |
|----------|-----------|------------|
| **Basic** | `$eq`, `$ne` | `string \| number \| Date \| boolean \| null` |
| **Comparison** | `$gt`, `$gte`, `$lt`, `$lte` | `string \| number \| Date` |
| **Pattern** | `$like`, `$ilike`, `$notlike`, `$notilike` | `string` |
| **Array** | `$in`, `$notin` (`$nin` alias) | `Array<string \| number>` |
| **Between** | `$between`, `$notbetween` | `[start, end]` where each is `string \| number \| Date` |
| **Null** | `$isnull`, `$notnull` | no value |

## Type Safety

The library provides compile-time type checking for operators and their values — both with a typed schema and with the default untyped builder:

```typescript
// ✅ These compile — correct value types
ConditionBuilder.create().where({
  name: { $like: '%John%' },           // string for $like
  age: { $gt: 18 },                    // number for $gt
  tags: { $in: ['active', 'vip'] },    // string[] for $in
  range: { $between: [1, 10] },        // [number, number] for $between
  status: { $eq: null },               // null allowed for $eq
})
```

```typescript
// ❌ These show TypeScript errors
ConditionBuilder.create().where({
  name: { $like: 123 },                // Error: number not allowed for $like
  age: { $gt: true },                  // Error: boolean not allowed for $gt
  tags: { $in: 'not-array' },          // Error: string not allowed for $in
  range: { $between: [true, false] },  // Error: boolean not allowed in $between
})
```

## Nested Conditions

```typescript
const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .andGroup(group => group
    .where('age').gt(18)
    .where('type').in(['user', 'admin'])
  )
  .orGroup(group => group
    .where('vip').eq(true)
    .where('level').gte(5)
  )
  .build()

// Output:
// {
//   $and: [
//     { field: 'status', op: '$eq', value: 'active' },
//     {
//       $and: [
//         { field: 'age', op: '$gt', value: 18 },
//         { field: 'type', op: '$in', value: ['user', 'admin'] }
//       ]
//     },
//     {
//       $or: [
//         { field: 'vip', op: '$eq', value: true },
//         { field: 'level', op: '$gte', value: 5 }
//       ]
//     }
//   ]
// }
```

Groups can be nested to any depth (up to 50 levels):

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

Use `.isNull()` and `.isNotNull()` for explicit null checks. These produce conditions with no `value` property:

```typescript
const condition = ConditionBuilder.create()
  .where('deletedAt').isNull()          // Find non-deleted records
  .where('email').isNotNull()           // Find records with email
  .where('status').eq('active')
  .build()

// Output:
// {
//   $and: [
//     { field: 'deletedAt', op: '$isnull' },
//     { field: 'email', op: '$notnull' },
//     { field: 'status', op: '$eq', value: 'active' }
//   ]
// }
```

**Note:** `.eq(null)` produces `{ op: '$eq', value: null }`. At serialization time every adapter treats it as SQL `IS NULL` (and `$ne null` as `IS NOT NULL`) — a literal `= NULL` comparison never matches anything in SQL, so the library normalizes the useful semantics instead. `{ deletedAt: null }` in object notation therefore works as an IS NULL check on every adapter. Prefer `.isNull()` / `.isNotNull()` when you want the intent to be explicit in the JSON.

## Validation & Semantics

`ConditionBuilder.from()` (and the constructor) deep-clone, normalize and **validate** the incoming condition tree — malformed JSON fails immediately with a pointed message (including the path and field name) instead of failing deep inside an adapter at serialization time:

```typescript
ConditionBuilder.from({ field: 'age', op: '$foo', value: 1 })
// Error: condition (field 'age'): unknown operator '$foo' (string)

ConditionBuilder.from({ $and: [...], $or: [...] })
// Error: condition: a condition group must contain either '$and' or '$or', not both
```

Operators are normalized to canonical form (`$EQ`/`eq` → `$eq`). The standalone `validateCondition()` / `validateConditionItem()` helpers are exported for validating conditions at your own API boundaries.

Behavioral contract, identical across all adapters (covered by a cross-adapter parity test suite):

- **Empty groups are a no-op.** An `orGroup()` whose callback added nothing does not constrain the query at any nesting level; `.build()` prunes empty groups from the output.
- **`$eq null` means `IS NULL`**, `$ne null` means `IS NOT NULL`.
- **Empty `$in []` matches nothing; empty `$notin []` matches everything.** The fluent `.in([])` still throws (an empty literal array is almost always a bug in code), but deserialized input is serialized safely.
- **Pattern escaping is dialect-independent** — Knex/Kysely emit `LIKE ? ESCAPE ?`. Note: the escape character is passed as a bound parameter; MySQL's *server-side* prepared statements reject a placeholder in ESCAPE (error 1210), but the default Knex/Kysely MySQL drivers use the text protocol and are unaffected.
- **`$ilike`/`$notilike` require a dialect with native `ILIKE`** (PostgreSQL family) in Kysely; the Knex adapter falls back to `LIKE` on other dialects, where case-insensitivity depends on the column collation. This is the one operator pair that is not fully dialect-portable.
- A group must contain exactly one of `$and`/`$or` — both at once is rejected.

Passing a built `Condition` where a field descriptor is expected (e.g. `create(condition)` or `where(condition)`) throws with a hint to use `ConditionBuilder.from()` — previously this silently produced garbage conditions.

## Adapters

Adapters convert between `Condition` objects and external formats. They implement `IConditionSerializer` (condition → external) or `IConditionDeserializer` (external → condition).

### Knex Adapter (Serializer)

Converts a `Condition` to a function that applies WHERE clauses to a Knex QueryBuilder.

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

// applyConditions is a function: (qb: Knex.QueryBuilder) => Knex.QueryBuilder
const results = await knex('users').modify(applyConditions)
```

`knex` is an optional peer dependency — the adapter throws a helpful error if it's not installed.

### Kysely Adapter (Serializer)

Converts a `Condition` to a function that applies `WHERE` clauses to a Kysely query builder.

```typescript
import { Kysely, PostgresDialect } from 'kysely'
import { ConditionBuilder, KyselyConditionAdapter } from '@cleverjs/condition-builder'

interface Database {
  users: { id: number; name: string; status: string; age: number }
}

const db = new Kysely<Database>({ dialect: new PostgresDialect({ /* ... */ }) })

const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .where('age').gt(18)
  .orGroup(g => g
    .where('name').ilike('%John%')
    .where('name').ilike('%Jane%')
  )
  .build()

const adapter = new KyselyConditionAdapter()
const applyConditions = adapter.serialize(condition)

// applyConditions: <QB>(qb: QB) => QB — preserves the original builder type.
// Works with SelectQueryBuilder, UpdateQueryBuilder, and DeleteQueryBuilder.
const users = await applyConditions(db.selectFrom('users').selectAll()).execute()
```

**Operator mapping notes:**
- `$between` is converted to `eb.and([col >= start, col <= end])` (works on all dialects).
- `$notbetween` is converted to `eb.or([col < start, col > end])`.
- `$ilike` is passed through as the `ilike` operator (Postgres). On other dialects, choose `$like` or implement a custom adapter.
- `$isnull` / `$notnull` use `is null` / `is not null`.

`kysely` is an optional peer dependency.

### MikroORM Adapter (Serializer)

Converts a `Condition` to a MikroORM `FilterQuery<T>` object.

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

**Operator mapping notes:**
- `$between` is converted to `{ $gte: start, $lte: end }`
- `$notbetween` is converted to `{ $or: [{ $lt: start }, { $gt: end }] }`
- `$notlike` is converted to `{ $not: { $like: value } }`
- `$isnull` is converted to `{ field: null }`

`@mikro-orm/core` is an optional peer dependency.

### Kendo UI Filter Adapter (Deserializer)

Converts Kendo UI DataSource filter objects into a `ConditionBuilder`, which you can continue building on.

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
// → { field: 'name', op: '$eq', value: 'John' }

// Continue building after deserialization
builder.where('age').gt(18)
```

**Composite filter with logic:**
```typescript
const builder = adapter.deserialize({
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

const condition = builder.build()
// → {
//   $and: [
//     { field: 'category', op: '$eq', value: 'electronics' },
//     {
//       $or: [
//         { field: 'price', op: '$lt', value: 100 },
//         { field: 'onSale', op: '$eq', value: true }
//       ]
//     }
//   ]
// }
```

**Supported Kendo operators** (case-insensitive):

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

Pattern values are automatically escaped (`%`, `_`, `\` characters), and the Knex/Kysely adapters emit an explicit `ESCAPE` clause, so escaping behaves identically on every dialect (including SQLite and MSSQL, which have no default escape character). Negated pattern operators map to `$notilike` so an operator and its negation stay case-insensitive symmetrically. The `escapeLikeValue()` helper is exported for building your own patterns from user input.

### Adapter Registry

`ConditionAdapterRegistry` manages adapters by type key. Create instances directly (DI-friendly) or use the factory function:

```typescript
import {
  ConditionAdapterRegistry,
  createConditionAdapterRegistry,
  AdapterType,
  KnexConditionAdapter,
  KyselyConditionAdapter,
  MikroOrmConditionAdapter,
  KendoFilterAdapter,
} from '@cleverjs/condition-builder'

// Option 1: Constructor with plugins
const registry = new ConditionAdapterRegistry([
  { type: AdapterType.KNEX, serializer: new KnexConditionAdapter() },
  { type: AdapterType.KYSELY, serializer: new KyselyConditionAdapter() },
  { type: AdapterType.MIKROORM, serializer: new MikroOrmConditionAdapter() },
  { type: AdapterType.KENDO, deserializer: new KendoFilterAdapter() },
])

// Option 2: Factory function
const registry2 = createConditionAdapterRegistry([
  { type: AdapterType.KNEX, serializer: new KnexConditionAdapter() },
])

// Option 3: Empty registry + manual registration
const registry3 = new ConditionAdapterRegistry()
registry3.register(AdapterType.KNEX, new KnexConditionAdapter())
registry3.register(AdapterType.KENDO, undefined, new KendoFilterAdapter())

// Retrieve adapters
const knex = registry.getSerializer(AdapterType.KNEX)
const kendo = registry.getDeserializer(AdapterType.KENDO)

// Register custom adapters with any string key
registry.register('custom', myCustomAdapter)

// Other methods
registry.hasSerializer(AdapterType.KNEX)   // true
registry.hasDeserializer(AdapterType.KNEX) // false
registry.getRegisteredTypes()              // ['knex', 'kysely', 'mikroorm', 'kendo', 'custom']
registry.unregister(AdapterType.KNEX)
registry.clear()
```

#### NestJS Integration

The registry works seamlessly with NestJS dependency injection:

```typescript
import { Module } from '@nestjs/common'
import {
  ConditionAdapterRegistry,
  AdapterType,
  KnexConditionAdapter,
  KendoFilterAdapter,
} from '@cleverjs/condition-builder'

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

### Custom Adapters

To create a custom adapter, implement `IConditionSerializer` and/or `IConditionDeserializer`:

```typescript
import type { Condition, IConditionSerializer, IConditionDeserializer } from '@cleverjs/condition-builder'
import { ConditionBuilder } from '@cleverjs/condition-builder'

// Serializer: Condition → your target format
class MySerializer implements IConditionSerializer<MyQueryFormat> {
  public serialize(condition: Condition): MyQueryFormat {
    // Convert condition tree to your target format
  }
}

// Deserializer: your source format → ConditionBuilder
class MyDeserializer implements IConditionDeserializer<MyFilterFormat> {
  public deserialize(input: MyFilterFormat): ConditionBuilder {
    // Convert your format into a ConditionBuilder
  }
}
```

Both interfaces accept an optional `options` parameter with `fieldMapping` for field name remapping.

### Adapter Plugins

You can also register adapters via the `IAdapterPlugin` interface:

```typescript
import type { IAdapterPlugin } from '@cleverjs/condition-builder'

const myPlugin: IAdapterPlugin = {
  type: 'my-adapter',
  serializer: new MySerializer(),
  deserializer: new MyDeserializer(),
}

registry.registerPlugin(myPlugin)
```

### Complete Example — API Endpoint

```typescript
import {
  KendoFilterAdapter,
  ConditionBuilder,
  KnexConditionAdapter,
} from '@cleverjs/condition-builder'

app.post('/api/products/filter', async (req, res) => {
  const { filter } = req.body // Kendo filter from client

  // Convert Kendo filter → ConditionBuilder → Knex query
  const kendoAdapter = new KendoFilterAdapter()
  const builder = kendoAdapter.deserialize(filter)

  // Optionally add server-side conditions
  builder.where('deletedAt').isNull()

  const condition = builder.build()

  const knexAdapter = new KnexConditionAdapter()
  const applyConditions = knexAdapter.serialize(condition)

  const results = await knex('products').modify(applyConditions)
  res.json(results)
})
```

## Field Mapping

All adapters support a `fieldMapping` option to rename fields during serialization or deserialization. This is useful when your API uses different field names than your database columns.

### Deserialization (external → internal)

Map incoming field names to your internal representation:

```typescript
import { KendoFilterAdapter } from '@cleverjs/condition-builder'

const adapter = new KendoFilterAdapter()

const kendoFilter = {
  logic: 'and',
  filters: [
    { field: 'user_id', operator: 'eq', value: 123 },
    { field: 'created_at', operator: 'gt', value: '2023-01-01' },
  ],
}

// Map snake_case API fields → camelCase internal fields
const condition = adapter.deserialize(kendoFilter, {
  fieldMapping: {
    user_id: 'userId',
    created_at: 'createdAt',
  },
}).build()

// → {
//   $and: [
//     { field: 'userId', op: '$eq', value: 123 },
//     { field: 'createdAt', op: '$gt', value: '2023-01-01' }
//   ]
// }
```

### Serialization (internal → external)

Map internal field names to database column names:

```typescript
import { MikroOrmConditionAdapter, ConditionBuilder } from '@cleverjs/condition-builder'

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

// → { $and: [{ user_id: 123 }, { created_at: { $gt: '2023-01-01' } }] }
```

### Round-Trip Mapping

Combine both directions for a full pipeline:

```typescript
const kendoAdapter = new KendoFilterAdapter()
const mikroAdapter = new MikroOrmConditionAdapter()

// 1. Deserialize Kendo filter, mapping API fields → internal
const condition = kendoAdapter.deserialize(kendoFilter, {
  fieldMapping: { user_id: 'userId', email_address: 'emailAddress' },
}).build()

// 2. Serialize to MikroORM, mapping internal → DB columns
const where = mikroAdapter.serialize(condition, {
  fieldMapping: { userId: 'user_id', emailAddress: 'email_address' },
})
```

Unmapped fields pass through unchanged.

## Importing Types

The library exports all types needed for working with conditions programmatically:

```typescript
// Core condition types
import type { Condition, ConditionGroup, ConditionItem } from '@cleverjs/condition-builder'

// Value types
import type { SimpleValue, ComparisonValue, BetweenValue, Range } from '@cleverjs/condition-builder'

// Operator types
import type { Operator, BasicOperator, ComparisonOperator, PatternOperator } from '@cleverjs/condition-builder'

// Adapter interfaces (for custom adapters)
import type { IConditionSerializer, IConditionDeserializer, IAdapterPlugin } from '@cleverjs/condition-builder'

// Descriptor type (for object notation)
import type { WhereDescriptor } from '@cleverjs/condition-builder'
```

## Output Format

`.build()` produces JSON objects. When the result contains a single condition, it is automatically unwrapped from the `$and` wrapper:

```typescript
// Single condition → unwrapped
ConditionBuilder.create().where('name').eq('John').build()
// → { field: 'name', op: '$eq', value: 'John' }

// Multiple conditions → $and group
ConditionBuilder.create().where('name').eq('John').where('age').gt(18).build()
// → { $and: [{ field: 'name', op: '$eq', value: 'John' }, { field: 'age', op: '$gt', value: 18 }] }
```

**Single condition:**
```json
{ "field": "name", "op": "$eq", "value": "John" }
```

**AND conditions:**
```json
{
  "$and": [
    { "field": "age", "op": "$gt", "value": 18 },
    { "field": "status", "op": "$eq", "value": "active" }
  ]
}
```

**Nested groups:**
```json
{
  "$and": [
    { "field": "role", "op": "$eq", "value": "admin" },
    {
      "$or": [
        { "field": "vip", "op": "$eq", "value": true },
        { "field": "level", "op": "$gte", "value": 5 }
      ]
    }
  ]
}
```

**Null checks** (no `value` property):
```json
{ "field": "deletedAt", "op": "$isnull" }
```