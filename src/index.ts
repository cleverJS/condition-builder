// Adapters
export {
  KnexConditionAdapter,
  MikroOrmConditionAdapter,
  IConditionAdapter,
  IConditionDeserializer,
  IConditionSerializer,
  KendoFilterAdapter,
  ConditionAdapterRegistry,
  AdapterType,
} from './adapters'

export type { IAdapterPlugin, AdapterTypeValue } from './adapters'

// Kendo types
export type { KendoFilter, IKendoItem, IKendoGroup, KendoOperator } from './adapters'

// Builder classes and main types
export { ConditionBuilder, FieldBuilder, WhereDescriptor, ConditionGroup, ConditionItem, Condition } from './builder'

// Type system - value types
export type { SimpleValue, SimpleValueArray, BetweenValue, ComparisonValue } from './builder/interfaces/types'

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
