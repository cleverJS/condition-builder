# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@cleverjs/condition-builder` — a TypeScript library that builds nested JSON objects representing SQL WHERE conditions. ORM-agnostic: build conditions once, apply via adapters to Knex, Kysely, MikroORM, or custom targets.

## Commands

- **Build:** `pnpm build` (SWC compilation + TypeScript declarations)
- **Clean:** `pnpm clean`
- **Run all tests:** `pnpm tests`
- **Run a single test:** `pnpm vitest run tests/condition-builder.test.ts`
- **Test coverage:** `pnpm test-coverage`
- **Lint:** `npx eslint src` (must stay at 0 errors)

Tests use Vitest with `globals: true` (no imports needed for `describe`/`it`/`expect`). All tests run against better-sqlite3 in memory — no external services needed. `tests/adapter-parity.test.ts` executes the same conditions through Knex and Kysely against identical live datasets and asserts identical row sets; extend it whenever adapter semantics change.

## Architecture

### Builder (`src/builder/`)

- **ConditionBuilder\<TSchema\>** — main entry point. Fluent API to construct condition trees. Created via `ConditionBuilder.create()` or `ConditionBuilder.from()` (parse existing JSON — deep-clones, normalizes operator case, and validates; malformed input throws immediately). Supports `.where()`, `.andGroup()`, `.orGroup()`, then `.build()` to produce a JSON `Condition` object. `.build()` prunes empty groups (empty group = no-op by contract).
- **FieldBuilder** — returned by `builder.where('field')`, exposes typed operator methods (`.eq()`, `.in()`, `.between()`, `.isNull()`, etc.) that return the builder for chaining.
- Raw condition items (plain `{ field, op, value }` objects) are appended via `.addCondition()`, which validates them. There is no raw-SQL wrapper class.

### Type system (`src/builder/interfaces/`)

- `types.ts` — operators (`$eq`, `$ne`, `$gt`, `$like`, `$notilike`, `$in`, `$between`, `$isnull`, etc.), value types (`SimpleValue`, `BetweenValue`, `ComparisonValue`), and `OperatorValueType` mapping that enforces correct value types per operator at compile time.
- `descriptors.ts` — `WhereDescriptor` types for shorthand/object notation input. Multiple operator keys on one field (`{ age: { $gte: 18, $lte: 65 } }`) combine with AND.
- Core union: `Condition = ConditionGroup | ConditionItem`. Groups use `{ $and: Condition[] }` or `{ $or: Condition[] }` — exactly one of the two keys; both at once is rejected by validation.

### Utils (`src/utils/`)

- `condition-validation.ts` — `validateCondition`/`validateConditionItem` (used by `from()`/constructor/`addCondition`), `pruneEmptyGroups` (used by `build()` and every serializer), `normalizeOperator`, operator category sets (`PATTERN_OPS`, `NULL_OPS`, …).
- `field-mapping.ts` — `mapFieldName` uses `Object.hasOwn`; never resolve field names through the prototype chain (field names can be attacker-controlled via deserializers).
- `escape-like.ts` — `escapeLikeValue` backslash-escapes `%`, `_`, `\`; serializers must emit a matching `ESCAPE` clause.

### Adapters (`src/adapters/`)

Adapters convert between `Condition` objects and external formats:

- **KnexConditionAdapter** (serializer) — applies conditions to a Knex QueryBuilder.
- **KyselyConditionAdapter** (serializer) — returns an applier for Kysely query builders.
- **MikroOrmConditionAdapter** (serializer) — converts to MikroORM filter objects.
- **KendoFilterAdapter** (deserializer) — converts Kendo UI filter format (client-controlled input — validate everything) into `Condition` objects.
- **ConditionAdapterRegistry** — DI-friendly registry for managing adapter instances by type key. Supports constructor injection with plugins, factory function (`createConditionAdapterRegistry`), and a deprecated `getInstance()` singleton for backward compatibility.

Adapters implement `IConditionSerializer` or `IConditionDeserializer`. Knex, Kysely and MikroORM are optional peer dependencies: use type-only imports, and probe availability at module load (`require.resolve` in try/catch for Knex, a lazy `require('kysely')` in try/catch for Kysely's `sql` helper) — never add a static value import of a peer dependency.

Cross-adapter semantic contract (enforced by `tests/adapter-parity.test.ts`): empty groups are a no-op at any nesting level; `$eq null` → `IS NULL`, `$ne null` → `IS NOT NULL`; empty `$in []` matches nothing, empty `$notin []` matches everything; pattern operators emit `LIKE ? ESCAPE ?` in Knex/Kysely.

### Field mapping

Adapters support a `fieldMapping` option (`Record<string, string>`) to rename fields during serialization/deserialization (e.g., map API field names to DB column names).

## Code Style

- Prettier: single quotes, no semicolons, trailing commas (ES5)
- ESLint: strict TypeScript, max cognitive complexity 15, max function length 75 lines, max 4 parameters, explicit member accessibility
- Import order: third-party → `@core/` → relative
