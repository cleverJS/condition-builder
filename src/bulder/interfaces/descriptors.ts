import { Operator, SimpleValue, SimpleValueArray, BetweenValue, OperatorValueType } from './types'

// Each condition can be one of:
// 1. A simple value (converts to $eq)
// 2. A simple array (converts to $in)
// 3. An operator descriptor (e.g., { $eq: value })
// 4. An explicit operator (e.g., { op: '$eq', value })
type ConditionDescriptor =
  | SimpleValue
  | SimpleValueArray
  | { [K in Operator]?: OperatorValueType[K] }
  | { op: Operator; value: unknown }

// WhereDescriptor with looser typing for better inference
export type WhereDescriptor = Record<string, ConditionDescriptor>
