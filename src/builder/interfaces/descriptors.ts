import { Operator, SimpleValue, SimpleValueArray, OperatorValueType } from './types'

// Each condition can be one of:
// 1. A simple value (converts to $eq)
// 2. A simple array (converts to $in)
// 3. An operator descriptor (e.g., { $eq: value })
// 4. An explicit operator (e.g., { op: '$eq', value })
type ConditionDescriptor =
  | SimpleValue
  | SimpleValueArray
  | { [K in Operator]?: K extends keyof OperatorValueType ? OperatorValueType[K] : unknown }
  | { op: Operator; value: unknown }

// WhereDescriptor with looser typing for better inference
export type WhereDescriptor<TSchema = Record<string, any>> = {
  [K in keyof TSchema]?: ConditionDescriptor
} & Record<string, ConditionDescriptor>
