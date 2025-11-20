import { ConditionGroup, ConditionItem } from '../../builder'

export interface ConditionSerializer<TOutput> {
  serialize(condition: ConditionGroup | ConditionItem): TOutput
}

export interface ConditionDeserializer<TInput> {
  deserialize(input: TInput): ConditionGroup | ConditionItem
}

export interface ConditionAdapter<TFormat> extends ConditionSerializer<TFormat>, ConditionDeserializer<TFormat> {}
