// Adapters
export {
  KnexConditionAdapter,
  KnexConditionApplier,
  MikroOrmConditionAdapter,
  IConditionAdapter,
  IConditionDeserializer,
  IConditionSerializer,
  KendoFilterAdapter,
  ConditionAdapterRegistry,
  createConditionAdapterRegistry,
  AdapterType,
} from './adapters'

export type { IAdapterPlugin, AdapterTypeValue } from './adapters'

// Kendo types
export type { KendoFilter, IKendoItem, IKendoGroup, KendoOperator } from './adapters'
export { EKendoOperator } from './adapters'

// Builder classes and main types
export { ConditionBuilder, CB, FieldBuilder, ConditionGroup, ConditionItem, Condition } from './builder'

// Type system - descriptor types
export type { WhereDescriptor } from './builder/interfaces/descriptors'

// Type system - value types
export type { SimpleValue, SimpleValueArray, BetweenValue, ComparisonValue, Range } from './builder/interfaces/types'

// Type system - operators
export type {
  Operator,
  BasicOperator,
  ComparisonOperator,
  PatternOperator,
  ArrayOperator,
  BetweenOperator,
  NullOperator,
  OperatorValueType,
} from './builder/interfaces/types'
