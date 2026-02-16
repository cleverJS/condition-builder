import { IDeserializationOptions, ISerializationOptions } from '../adapters/interfaces/IConditionAdapter'

export function mapFieldName(fieldName: string, options?: ISerializationOptions | IDeserializationOptions): string {
  if (options?.fieldMapping && options.fieldMapping[fieldName]) {
    return options.fieldMapping[fieldName]
  }
  return fieldName
}
