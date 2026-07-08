export type Range = string | number | Date
export type SimpleValue = string | number | Date | boolean | null
export type SimpleValueArray = Array<string | number>
export type BetweenValue = [string | number | Date, string | number | Date]
export type ComparisonValue = Exclude<SimpleValue, boolean | null>

export type Operator = BasicOperator | ComparisonOperator | PatternOperator | ArrayOperator | BetweenOperator | NullOperator

// Strongly typed operator groups
export type BasicOperator = '$eq' | '$ne'
export type ComparisonOperator = '$gt' | '$gte' | '$lt' | '$lte'
export type PatternOperator = '$like' | '$notlike' | '$ilike' | '$notilike'
export type ArrayOperator = '$in' | '$notin' | '$nin'
export type BetweenOperator = '$between' | '$notbetween'
export type NullOperator = '$isnull' | '$notnull'

// Map each operator to its allowed value type
export interface OperatorValueType {
  // Basic operators
  $eq: SimpleValue
  $ne: SimpleValue
  // Comparison operators
  $gt: ComparisonValue
  $gte: ComparisonValue
  $lt: ComparisonValue
  $lte: ComparisonValue
  // Pattern operators
  $like: string
  $notlike: string
  $ilike: string
  $notilike: string
  // Array operators
  $in: SimpleValueArray
  $notin: SimpleValueArray
  $nin: SimpleValueArray
  // Between operators
  $between: BetweenValue
  $notbetween: BetweenValue
  // Null operators: false inverts the check ({ $isnull: false } means IS NOT NULL)
  $isnull: boolean
  $notnull: boolean
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

export interface ConditionGroup {
  $and?: Array<Condition>
  $or?: Array<Condition>
}

export type Condition = ConditionGroup | ConditionItem
