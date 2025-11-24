# Condition Builder

A small, type-safe TypeScript library for building **ORM-agnostic**, portable, JSON-serializable condition
objects for queries and filters. Write your query logic once and use it with any database layer - Knex, MikroORM,
or your custom implementation. The library provides strict type checking for operators and their values, making
query construction safe and predictable.

## Key Features
- **ORM/Database Agnostic**: Unified abstraction layer - write conditions once, use with any query builder or ORM
- **No Vendor Lock-In**: Easily switch between Knex, MikroORM, or implement custom adapters for any database layer
- **Type-Safe Operators**: All operators (`$eq`, `$gt`, `$like`, etc.) are strictly typed with their allowed value types
- **Typed Schema Support**: Optional generic type parameter for field name autocomplete and type checking
- **Fluent Builder API**: Chainable builder pattern for constructing condition trees
- **JSON Serializable**: Store, transmit, and cache conditions - perfect for APIs, saved filters, and dynamic queries
- **Flexible Input**: Supports multiple input formats with runtime validation
- **AND/OR Groups**: Create nested condition groups with proper type inference
- **Built-in Adapters**: Out-of-the-box support for Knex, MikroORM, and Kendo UI filters

## Installation
```bash
npm install @cleverJS/condition-builder
# or
pnpm install @cleverJS/condition-builder
```

## Quick Start
```typescript
import { ConditionBuilder } from '@cleverJS/condition-builder'

// Simple conditions with fluent API
const builder = ConditionBuilder.create()
  .where('age').gt(21)                // number for $gt
  .where('name').like('%John%')       // string for $like
  .where('tags').in(['A', 'B'])       // string[] for $in
  .where('range').between(1, 10)      // numbers for $between
```

```typescript
import { ConditionBuilder } from '@cleverJS/condition-builder'

interface UserSchema {
  name: string
  age: number
  email: string
  isActive: boolean
}

const builder = ConditionBuilder.create<UserSchema>()
  .where('name').eq('John')           // ✅ 'name' is autocompleted
  .where('age').gt(21)                // ✅ 'age' is autocompleted
  .where('email').ilike('%@example.com')
```

```typescript
import { ConditionBuilder } from '@cleverJS/condition-builder'

// Object notation with type checking
const builder = ConditionBuilder.create()
  .where({
    status: 'active',                 // simple value → $eq
    age: { $gt: 21 },                 // typed operators
    tags: ['A', 'B'],                 // array → $in
    search: { $like: '%term%' },      // pattern match
    range: { $between: [1, 10] }      // typed tuples
  })
```

```typescript
import { ConditionBuilder } from '@cleverJS/condition-builder'

// Object notation on create with type checking
const builder = ConditionBuilder.create({
  status: 'active',                   // simple value → $eq
  age: { $gt: 21 },                   // typed operators
  tags: ['A', 'B'],                   // array → $in
  search: { $like: '%term%' },        // pattern match
  range: { $between: [1, 10] }        // typed tuples
})
```

```typescript
import { ConditionBuilder } from '@cleverJS/condition-builder'

// Get JSON output
const json = builder.build()
```

## Type Safety
The library provides compile-time type checking for operators and their values:

```typescript
// ✅ These compile - correct value types
ConditionBuilder.create().where({
  name: { $like: '%John%' },           // string for $like
  age: { $gt: 18 },                    // number for $gt
  tags: { $in: ['active', 'vip'] },    // string[] for $in
  range: { $between: [1, 10] },        // [number, number] for $between
  status: { $eq: null },               // null allowed for $eq
})
```

```typescript
// For null checks, just specify the field
ConditionBuilder.create()
  .where('deleted').isNull()           // No value needed
  .where('active').isNotNull()         // No value needed
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

## API Reference

### ConditionBuilder
- `create()`: Start a new condition builder
- `create(field, op, value)`: Start with a single condition
- `create(descriptor)`: Start with multiple conditions from an object
- `from(condition)`: Static method to create a builder from an existing `ConditionGroup` or `ConditionItem`
- `where()`: Add conditions in multiple formats:
  ```typescript
  where(field: string): FieldBuilder                    // Chain operators
  where(field: string, op: Operator, value: T): this   // Direct operator
  where(descriptor: WhereDescriptor): this             // Object notation
  ```
- `andGroup(callback)`: Create nested AND group
- `orGroup(callback)`: Create nested OR group
- `build()`: Get the final condition object

**Example: Initialize from existing conditions**
```typescript
const existing = { $and: [{ field: 'status', op: '$eq', value: 'active' }] }
const builder1 = ConditionBuilder.from(existing)
builder1.where('age').gt(18) // Continue building with any field name

// Works with ConditionItem too
const item = { field: 'name', op: '$eq', value: 'John' }
const builder2 = ConditionBuilder.from(item)
builder2.where('age').gt(21)
builder2.where('deletedAt').isNull()
```

### Operators
All operators are prefixed with $ and strictly typed:

#### Basic Operators
- `$eq`: Equals (any value)
- `$ne`: Not equals (any value)

#### Comparison Operators
- `$gt`, `$gte`: Greater than (number/string/Date)
- `$lt`, `$lte`: Less than (number/string/Date)

#### Pattern Operators
- `$like`: Pattern match (string only)
- `$ilike`: Case-insensitive pattern (string only)
- `$notlike`: Pattern not match (string only)

#### Array Operators
- `$in`: In array (string[]/number[])
- `$notin`: Not in array (string[]/number[])

#### Between Operators
- `$between`: Between range ([start, end])
- `$notbetween`: Not between range ([start, end])

#### Null Operators
- `$isnull`: Is null (no value needed)
- `$notnull`: Is not null (no value needed)

## Examples

### Nested Conditions
```typescript
const builder = ConditionBuilder.create()
  .where('status', '$eq', 'active')
  .andGroup(group => group
    .where('age', '$gt', 18)
    .where('type', '$in', ['user', 'admin'])
  )
  .orGroup(group => group
    .where('vip', '$eq', true)
    .where('level', '$gte', 5)
  )
```

### Object Notation with Explicit Types
```typescript
const conditions = {
  // Simple equality
  status: 'active',

  // Comparison with numbers
  age: { $gte: 18 },
  score: { $lt: 100 },

  // Pattern matching
  email: { $like: '%@example.com' },
  name: { $ilike: 'john%' },

  // Arrays and ranges
  tags: { $in: ['premium', 'trial'] },
  range: { $between: [0, 999] },
}

const builder = ConditionBuilder.create().where(conditions)
```

### Using Null Checks
```typescript
const builder = ConditionBuilder.create()
  .where('deletedAt').isNull()        // Find non-deleted records
  .where('email').isNotNull()         // Find records with email
  .where('status').eq('active')
```

## Adapters

The library includes adapters to convert between external filter formats and condition objects:

### Converting TO Database Queries (Serializers)

```typescript
import { 
  KnexConditionAdapter, 
  MikroOrmConditionAdapter 
} from '@cleverJS/condition-builder'

// Use with Knex
const knexAdapter = new KnexConditionAdapter()
const condition = ConditionBuilder.create()
  .where('status').eq('active')
  .where('age').gt(18)
  .build()

const applyConditions = knexAdapter.serialize(condition)
const knexQuery = knex('users')
applyConditions(knexQuery) // Applies conditions to Knex query

// Use with MikroORM
const mikroAdapter = new MikroOrmConditionAdapter()
const where = mikroAdapter.serialize(condition)
await em.find(User, where)
```

### Converting FROM External Formats (Deserializers)

#### Kendo UI DataSource Filter Adapter

Convert Kendo UI DataSource filters to a `ConditionBuilder`:

```typescript
import { KendoFilterAdapter } from '@cleverJS/condition-builder'

const adapter = new KendoFilterAdapter()

// Simple Kendo filter
const kendoFilter = {
  field: 'name',
  operator: 'eq',
  value: 'John'
}

// deserialize() returns a ConditionBuilder - you can continue building or get the final result
const builder = adapter.deserialize(kendoFilter)
const condition = builder.build()
// Result: { field: 'name', op: '$eq', value: 'John' }

// You can also continue building after deserialization
const builder2 = adapter.deserialize(kendoFilter)
builder2.where('age').gt(18) // Add more conditions
const finalCondition = builder2.build()

// Composite Kendo filter with logic
const complexFilter = {
  logic: 'and',
  filters: [
    { field: 'category', operator: 'eq', value: 'electronics' },
    {
      logic: 'or',
      filters: [
        { field: 'price', operator: 'lt', value: 100 },
        { field: 'onSale', operator: 'eq', value: true }
      ]
    }
  ]
}

const complexBuilder = adapter.deserialize(complexFilter)
const conditionGroup = complexBuilder.build()
// Result:
// {
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

**Supported Kendo Operators:**
- `eq`, `neq` → `$eq`, `$ne`
- `gt`, `gte`, `lt`, `lte` → `$gt`, `$gte`, `$lt`, `$lte`
- `in` → `$in`
- `contains` → `$ilike` with `%value%`
- `doesnotcontain` → `$notlike` with `%value%`
- `startswith` → `$ilike` with `value%`
- `endswith` → `$ilike` with `%value`
- `doesnotstartwith` → `$notlike` with `value%`
- `doesnotendwith` → `$notlike` with `%value`
- `isnull`, `isnotnull` → `$isnull`, `$notnull`
- `isempty`, `isnotempty` → `$eq ''`, `$ne ''`
- `isnullorempty` → `$or` group with `$isnull` and `$eq ''`
- `isnotnullorempty` → `$and` group with `$notnull` and `$ne ''`

**Note:** Operators are case-insensitive, so `EQ`, `eq`, and `Eq` are all treated the same.

#### Adapter Registry

The `ConditionAdapterRegistry` is a singleton that allows registering and retrieving adapters by type:

```typescript
const registry = ConditionAdapterRegistry.getInstance()

const knexAdapter = new KnexConditionAdapter()
registry.register(AdapterType.KNEX, knexAdapter)

const mikroOrmAdapter = new MikroOrmConditionAdapter()
registry.register(AdapterType.MIKROORM, mikroOrmAdapter)

const kendoAdapter = new KendoFilterAdapter()
registry.register(AdapterType.KENDO, undefined, kendoAdapter)

const customAdapter = new CustomConditionAdapter()
registry.register('custom_adapter', customAdapter)
```

**Complete Example - API Endpoint:**

```typescript
import { KendoFilterAdapter, ConditionBuilder, KnexConditionAdapter } from '@cleverJS/condition-builder'

// Express endpoint receiving Kendo UI Grid filter
app.post('/api/products/filter', async (req, res) => {
  const { filter } = req.body // Kendo filter from client
  
  // Convert Kendo filter to ConditionBuilder
  const kendoAdapter = new KendoFilterAdapter()
  const builder = kendoAdapter.deserialize(filter)
  
  // You can modify the builder before applying
  // builder.where('deletedAt').isNull() // Add extra conditions if needed
  
  // Build the final condition
  const condition = builder.build()
  
  // Use with Knex
  const knexAdapter = new KnexConditionAdapter()
  const applyConditions = knexAdapter.serialize(condition)
  
  const query = knex('products')
  applyConditions(query)
  
  const results = await query
  res.json(results)
})
```

## Typed Schema Support

Get autocomplete and type checking for field names by providing a schema interface:

```typescript
// Define your schema
interface UserSchema {
  id: number
  name: string
  email: string
  age: number
  isActive: boolean
  createdAt: Date
}

// Use it with ConditionBuilder
const condition = ConditionBuilder.create<UserSchema>()
  .where('name').eq('John')    // ✅ 'name' is autocompleted
  .where('age').gt(18)          // ✅ 'age' is autocompleted
  .where('email').ilike('%@example.com')  // ✅ Field names are type-checked

// TypeScript will catch typos:
// .where('nam').eq('John')     // ❌ Error: Property 'nam' does not exist
```

**Benefits:**
- ✅ **ORM/Database Agnostic**: Build queries once, use everywhere - the same condition object works with Knex, MikroORM, or any custom implementation via adapters
- ✅ **JSON Serializable**: Conditions can be stored, transmitted over network, or cached - perfect for API filters, saved searches, or dynamic queries
- ✅ **Type-Safe**: Compile-time validation of field names, operators, and values prevents runtime errors
- ✅ **IDE Autocomplete**: Full IntelliSense support for field names when using typed schemas
- ✅ **Consistent API**: Same intuitive builder pattern regardless of your underlying database or ORM
- ✅ **Testable**: Mock and test query logic without database dependencies
- ✅ **Better Refactoring**: Schema changes are caught at compile-time across your entire codebase
- ✅ **Self-Documenting**: Type definitions serve as living documentation of your data model

## Output Format

The library produces JSON objects with the following structure:

```typescript
// Simple AND conditions
{
  $and: [
    { field: 'age', op: '$gt', value: 18 },
    { field: 'status', op: '$eq', value: 'active' }
  ]
}

// Nested groups
{
  $and: [
    { field: 'role', op: '$eq', value: 'admin' },
    {
      $or: [
        { field: 'vip', op: '$eq', value: true },
        { field: 'level', op: '$gte', value: 5 }
      ]
    }
  ]
}

// Null checks
{
  $and: [
    { field: 'deletedAt', op: '$isnull' }
  ]
}
```
