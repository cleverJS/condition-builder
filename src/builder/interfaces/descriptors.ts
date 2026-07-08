import { Operator, OperatorValueType, SimpleValue } from './types'

// Detects `any` (e.g. an untyped schema): 1 & any = any, and 0 extends any
type IsAny<T> = 0 extends 1 & T ? true : false

// Operator descriptor: operator shorthand { $gt: value } (multiple keys are
// combined with AND) or explicit { op, value } — value is optional only for
// null operators ($isnull/$notnull)
type OperatorDescriptor = { [K in Operator]?: K extends keyof OperatorValueType ? OperatorValueType[K] : unknown } | { op: Operator; value?: unknown }

// Schema-aware condition descriptor for a single field.
// Simple values and array shorthands are constrained by the field type from TSchema.
// Operator descriptors retain their own type constraints independent of the schema.
// When the field type is `any` (untyped schema), fall back to the value types the
// runtime actually accepts — intersecting with `any` would swallow all checking.
type ConditionDescriptorFor<TFieldType> =
  IsAny<TFieldType> extends true
    ? SimpleValue | Array<string | number> | OperatorDescriptor
    : (TFieldType & SimpleValue) | null | Array<TFieldType & (string | number)> | OperatorDescriptor

export type WhereDescriptor<TSchema = Record<string, any>> = {
  [K in keyof TSchema]?: ConditionDescriptorFor<TSchema[K]>
}
