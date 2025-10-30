import { ConditionGroup, ConditionItem, ConditionJson } from './interfaces/types'

export interface ConditionAdapter<TOutput> {
  convert(condition: ConditionJson | ConditionGroup | ConditionItem): TOutput
}
