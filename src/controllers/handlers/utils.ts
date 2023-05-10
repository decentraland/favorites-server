import { isEthereumAddressValid } from '../../logic/ethereum/validations'
import { Permission } from '../../ports/access'

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
