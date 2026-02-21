import { Operator, OperatorValueType, SimpleValue } from './types'

// Operator descriptor: operator shorthand { $gt: value } or explicit { op, value }
type OperatorDescriptor = { [K in Operator]?: K extends keyof OperatorValueType ? OperatorValueType[K] : unknown } | { op: Operator; value: unknown }

// Schema-aware condition descriptor for a single field.
// Simple values and array shorthands are constrained by the field type from TSchema.
// Operator descriptors retain their own type constraints independent of the schema.
type ConditionDescriptorFor<TFieldType> = (TFieldType & SimpleValue) | null | Array<TFieldType & (string | number)> | OperatorDescriptor

export type WhereDescriptor<TSchema = Record<string, any>> = {
  [K in keyof TSchema]?: ConditionDescriptorFor<TSchema[K]>
}
