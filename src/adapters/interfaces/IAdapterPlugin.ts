import { IConditionDeserializer, IConditionSerializer } from './IConditionAdapter'

export interface IAdapterPlugin {
  readonly type: string
  readonly serializer?: IConditionSerializer<any>
  readonly deserializer?: IConditionDeserializer<any>
}
