import { JSONSchema } from '@dcl/schemas'
import { PickUnpickInBulkBody } from './types'

export const PickUnpickInBulkSchema: JSONSchema<PickUnpickInBulkBody> = {
  type: 'object',
  properties: {
    pickedFor: {
      type: 'array',
      items: {
        type: 'string'
      },
      nullable: true
    },
    unpickedFrom: {
      type: 'array',
      items: {
        type: 'string'
      },
      nullable: true
    }
  }
}
