import { isErrorWithMessage } from '../../logic/errors'
import { isEthereumAddressValid } from '../../logic/ethereum/validations'
import { Permission } from '../../ports/access'
import { AddListRequestBody, UpdateListRequestBody } from '../../ports/lists'
import { StatusCode } from '../../types'

export function validateAccessBody(body: { permission: Permission; grantee: string }) {
  if (!body.grantee || (body.grantee && typeof body.grantee !== 'string')) {
    throw new Error('The property grantee is missing or is not of string type.')
  } else if (body.grantee !== '*' && !isEthereumAddressValid(body.grantee)) {
    throw new Error('The property grantee is not valued as "*" or as an ethereum address.')
  }

  if (!body.permission || !Object.values(Permission).includes(body.permission)) {
    throw new Error('The property permission is missing or is not valued as view or edit.')
  }
}

export function validateCreateOrUpdateListBody(body: AddListRequestBody | UpdateListRequestBody) {
  // Name validations
  validateType(body, 'name', 'string')
  validateLength(body, 'name', 32)

  // Private validations
  validateType(body, 'private', 'boolean')

  // Description validations
  validateType(body, 'description', 'string')
  validateLength(body, 'description', 100)
}

export function wellKnownMessageOrUnknownError(error: unknown) {
  if (error instanceof SyntaxError) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: 'The body must contain a parsable JSON.'
      }
    }
  }

  return {
    status: StatusCode.BAD_REQUEST,
    body: {
      ok: false,
      message: isErrorWithMessage(error) && error.message ? error.message : 'Unknown error'
    }
  }
}

function validateType(
  body: AddListRequestBody | UpdateListRequestBody,
  property: keyof (AddListRequestBody | UpdateListRequestBody),
  type: string
) {
  const value = body[property]
  if (value && typeof value !== type) throw new Error(`The property ${property} is not of ${type} type.`)
}

function validateLength(
  body: AddListRequestBody | UpdateListRequestBody,
  property: keyof (AddListRequestBody | UpdateListRequestBody),
  length: number
) {
  const value = body[property]
  if (value && typeof value === 'string' && value.length > length) {
    throw new Error(`The property ${property} exceeds the ${length} characters.`)
  }
}
