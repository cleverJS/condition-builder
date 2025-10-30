# Condition Builder

A small, type-safe TypeScript library for building portable, JSON-serializable condition objects used in queries and filters. Features strict type checking for operators and their values.

## Key Features
- **Type-Safe Operators**: All operators ($eq, $gt, $like, etc.) are strictly typed with their allowed value types
- **Fluent Builder API**: Chain-friendly builder pattern for constructing condition trees
- **Flexible Input**: Supports multiple input formats with type validation
- **AND/OR Groups**: Create nested condition groups with proper type inference

## Installation
```bash
git clone <repo>
cd condition_builder
pnpm install  # or npm install
```

## Quick Start
```typescript
import { ConditionBuilder } from './src'

// Simple conditions with fluent API
const builder1 = ConditionBuilder.create()
  .where('age').gt(21)                // number for $gt
  .where('name').like('%John%')       // string for $like
  .where('tags').in(['A', 'B'])       // string[] for $in
  .where('range').between(1, 10)      // numbers for $between

// Object notation with type checking
const builder2 = ConditionBuilder.create()
  .where({
    status: 'active',                 // simple value -> $eq
    age: { $gt: 21 },                 // typed operators
    tags: ['A', 'B'],                // array -> $in
    search: { $like: '%term%' },      // pattern match
    range: { $between: [1, 10] }      // typed tuples
  })

// Object notation on create with type checking
const builder3 = ConditionBuilder.create({
  status: 'active',                 // simple value -> $eq
  age: { $gt: 21 },                 // typed operators
  tags: ['A', 'B'],                // array -> $in
  search: { $like: '%term%' },      // pattern match
  range: { $between: [1, 10] }      // typed tuples
})

// Get JSON output
const json = builder2.toJSON()
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
  deleted: { $isnull: true }           // only true for $isnull
})

// ❌ These show TypeScript errors
ConditionBuilder.create().where({
  name: { $like: 123 },                // Error: number not allowed for $like
  age: { $gt: true },                  // Error: boolean not allowed for $gt
  tags: { $in: 'not-array' },          // Error: string not allowed for $in
  range: { $between: [true, false] },  // Error: boolean not allowed in $between
  status: { $isnull: false }           // Error: only true allowed for $isnull
})
```

## API Reference

### ConditionBuilder
- `create()`: Start a new condition builder
- `where()`: Add conditions in multiple formats:
  ```typescript
  where(field: string): FieldBuilder                    // Chain operators
  where(field: string, op: Operator, value: T): this   // Direct operator
  where(descriptor: WhereDescriptor): this             // Object notation
  ```
- `andGroup(callback)`: Create nested AND group
- `orGroup(callback)`: Create nested OR group
- `toJSON()`: Get the final condition object

### Operators
All operators are prefixed with $ and strictly typed:

#### Basic Operators
- `$eq`: Equals (any value)
- `$ne`: Not equals (any value)

#### Comparison Operators
- `$gt`, `$gte`: Greater than (number/string/date)
- `$lt`, `$lte`: Less than (number/string/date)

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
- `$isnull`: Is null (true only)
- `$notnull`: Is not null (true only)

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
  
  // Null checks
  deleted: { $isnull: true }
}

const builder = ConditionBuilder.create().where(conditions)
```

## Type Definitions
The library exports TypeScript types for custom use:

```typescript
import type {
  Operator,              // Union of all operator literals
  WhereDescriptor,       // Object notation type
  ConditionJson,         // Output JSON type
  OperatorValueType      // Operator to value type mapping
} from './src/types'
```
