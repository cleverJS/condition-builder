import { Condition, ConditionGroup } from '../builder'

import { IDeserializationOptions, ISerializationOptions } from './interfaces/IConditionAdapter'

export function isConditionGroup(condition: Condition): condition is ConditionGroup {
  return '$and' in condition || '$or' in condition
}

export function mapFieldName(fieldName: string, options?: ISerializationOptions | IDeserializationOptions): string {
  if (options?.fieldMapping && options.fieldMapping[fieldName]) {
    return options.fieldMapping[fieldName]
  }
  return fieldName
}
