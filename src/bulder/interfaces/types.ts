export type SimpleValue = string | number | Date | boolean | null
export type SimpleValueArray = Array<string | number>
export type BetweenValue = [string | number | Date, string | number | Date]
export type ComparisonValue = Exclude<SimpleValue, boolean | null>

export type Operator =
  | BasicOperator
  | ComparisonOperator
  | PatternOperator
  | ArrayOperator
  | BetweenOperator
  | NullOperator

// Strongly typed operator groups
export type BasicOperator = '$eq' | '$ne'
export type ComparisonOperator = '$gt' | '$gte' | '$lt' | '$lte'
export type PatternOperator = '$like' | '$notlike' | '$ilike'
export type ArrayOperator = '$in' | '$notin'
export type BetweenOperator = '$between' | '$notbetween'
export type NullOperator = '$isnull' | '$notnull'

// Map each operator to its allowed value type
export type OperatorValueType = {
  // Basic operators
  '$eq': SimpleValue
  '$ne': SimpleValue
  // Comparison operators
  '$gt': ComparisonValue
  '$gte': ComparisonValue
  '$lt': ComparisonValue
  '$lte': ComparisonValue
  // Pattern operators
  '$like': string
  '$notlike': string
  '$ilike': string
  // Array operators
  '$in': SimpleValueArray
  '$notin': SimpleValueArray
  // Between operators
  '$between': BetweenValue
  '$notbetween': BetweenValue
  // Null operators
  '$isnull': true
  '$notnull': true
}

// Condition interfaces with strict typing
interface IConditionSimple {
  op: BasicOperator | ComparisonOperator
  field: string
  value: SimpleValue
}

interface IConditionBetween {
  op: BetweenOperator
  field: string
  value: BetweenValue
}

interface IConditionIN {
  op: ArrayOperator
  field: string
  value: SimpleValueArray
}

interface IConditionLike {
  op: PatternOperator
  field: string
  value: string
}

interface IConditionNull {
  op: NullOperator
  field: string
}

export type ConditionItem = IConditionSimple | IConditionBetween | IConditionIN | IConditionLike | IConditionNull

export type ConditionGroup = {
  type: 'and' | 'or'
  conditions: Array<ConditionItem | ConditionGroup>
}

export type ConditionJson = ConditionGroup
