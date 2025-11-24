import { Condition, ConditionBuilder } from '../../builder'

export interface IConditionSerializer<TOutput> {
  serialize(condition: Condition): TOutput
}

export interface IConditionDeserializer<TInput> {
  deserialize(input: TInput): ConditionBuilder
}

export interface IConditionAdapter<TFormat> extends IConditionSerializer<TFormat>, IConditionDeserializer<TFormat> {}
