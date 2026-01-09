import { Condition, ConditionBuilder } from '../../builder'

/**
 * Field name mapping configuration
 * Maps internal field names to external field names and vice versa
 *
 * @example
 * const mapping: FieldNameMapping = {
 *   // internal -> external
 *   userId: 'user_id',
 *   createdAt: 'created_at'
 * }
 */
export type FieldNameMapping = Record<string, string>

/**
 * Options for serialization
 */
export interface ISerializationOptions {
  /**
   * Maps internal field names to external field names
   * Used during serialization to transform field names
   */
  fieldMapping?: FieldNameMapping
}

/**
 * Options for deserialization
 */
export interface IDeserializationOptions {
  /**
   * Maps external field names to internal field names
   * Used during deserialization to transform field names
   */
  fieldMapping?: FieldNameMapping
}

export interface IConditionSerializer<TOutput> {
  serialize(condition: Condition, options?: ISerializationOptions): TOutput
}

export interface IConditionDeserializer<TInput> {
  deserialize(input: TInput, options?: IDeserializationOptions): ConditionBuilder
}

export interface IConditionAdapter<TFormat> extends IConditionSerializer<TFormat>, IConditionDeserializer<TFormat> {}
