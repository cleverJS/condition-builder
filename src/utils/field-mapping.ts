import { IDeserializationOptions, ISerializationOptions } from '../adapters/interfaces/IConditionAdapter'

export function mapFieldName(fieldName: string, options?: ISerializationOptions | IDeserializationOptions): string {
  const mapping = options?.fieldMapping
  // Object.hasOwn guards against prototype-chain lookups: field names like
  // 'constructor' or 'toString' (possibly attacker-controlled) must not resolve
  // to Object.prototype members and silently replace the field name.
  if (mapping && Object.hasOwn(mapping, fieldName)) {
    const mapped = mapping[fieldName]
    if (typeof mapped === 'string' && mapped.length > 0) {
      return mapped
    }
  }
  return fieldName
}
