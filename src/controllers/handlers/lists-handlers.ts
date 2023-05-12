import {
  fromDBGetListsToListsWithCount,
  fromDBGetPickByListIdToPickIdsWithCount,
  fromDBPickToPick,
  fromDBListToList,
  List
} from '../../adapters/lists'
import { TPick } from '../../adapters/picks'
import { isErrorWithMessage } from '../../logic/errors'
import { getPaginationParams } from '../../logic/http'
import { AccessNotFoundError, DuplicatedAccessError } from '../../ports/access/errors'
import { AddListRequestBody, ListSortBy, ListSortDirection } from '../../ports/lists'
import {
  DuplicatedListError,
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError
} from '../../ports/lists/errors'
import { HandlerContextWithPath, HTTPResponse, StatusCode } from '../../types'
import { AccessBody } from './types'
import { validateAccessBody } from './utils'

export async function getPicksByListIdHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists/:id/picks'>, 'url' | 'components' | 'params' | 'request' | 'verification'>
): Promise<HTTPResponse<Pick<TPick, 'itemId'>>> {
  const {
    url,
    components: { lists },
    verification,
    params
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  const { limit, offset } = getPaginationParams(url.searchParams)
  const picksByListIdResult = await lists.getPicksByListId(params.id, {
    userAddress,
    limit,
    offset
  })
  const { picks, count } = fromDBGetPickByListIdToPickIdsWithCount(picksByListIdResult)

  return {
    status: StatusCode.OK,
    body: {
      ok: true,
      data: {
        results: picks,
        total: picks.length > 0 ? count : 0,
        page: Math.floor(offset / limit),
        pages: picks.length > 0 ? Math.ceil(count / limit) : 0,
        limit
      }
    }
  }
}

export async function createPickInListHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists/:id/picks'>, 'components' | 'params' | 'request' | 'verification'>
): Promise<HTTPResponse<TPick>> {
  const {
    components: { lists },
    verification,
    params,
    request
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  let body: { itemId?: string }

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  try {
    body = await request.json()
    if (!body.itemId || (body.itemId && typeof body.itemId !== 'string')) {
      return {
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property itemId is missing or is not of string type.'
        }
      }
    }
  } catch (error) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: 'The body must contain a parsable JSON.'
      }
    }
  }

  try {
    const addPickToListResult = await lists.addPickToList(params.id, body.itemId, userAddress)
    return {
      status: StatusCode.CREATED,
      body: {
        ok: true,
        data: fromDBPickToPick(addPickToListResult)
      }
    }
  } catch (error) {
    if (error instanceof ListNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId
          }
        }
      }
    } else if (error instanceof PickAlreadyExistsError) {
      return {
        status: StatusCode.UNPROCESSABLE_CONTENT,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId,
            itemId: error.itemId
          }
        }
      }
    } else if (error instanceof ItemNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            itemId: error.itemId
          }
        }
      }
    }

    throw error
  }
}

export async function deletePickInListHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists/:id/picks/:itemId'>, 'components' | 'params' | 'verification'>
): Promise<HTTPResponse<undefined>> {
  const {
    components: { lists },
    verification,
    params
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  const { id, itemId } = params

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  try {
    await lists.deletePickInList(id, itemId, userAddress)
    return {
      status: StatusCode.OK,
      body: {
        ok: true,
        data: undefined
      }
    }
  } catch (error) {
    if (error instanceof PickNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId,
            itemId: error.itemId
          }
        }
      }
    }

    throw error
  }
}

export async function deleteAccessHandler(
  context: Pick<HandlerContextWithPath<'access', '/v1/lists/:id/access'>, 'components' | 'params' | 'request' | 'verification'>
) {
  const {
    components: { access },
    verification,
    params,
    request
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  const { id } = params

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  let body: AccessBody

  try {
    body = await request.json()
    validateAccessBody(body)
  } catch (error) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: isErrorWithMessage(error) ? error.message : 'Unknown error'
      }
    }
  }

  try {
    await access.deleteAccess(id, body.permission, body.grantee.toLowerCase(), userAddress)

    return {
      status: StatusCode.OK,
      body: {
        ok: true
      }
    }
  } catch (error) {
    if (error instanceof AccessNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId,
            permission: error.permission,
            grantee: error.grantee
          }
        }
      }
    }

    throw error
  }
}

export async function createAccessHandler(
  context: Pick<HandlerContextWithPath<'access', '/v1/lists/:id/access'>, 'components' | 'params' | 'request' | 'verification'>
) {
  const {
    components: { access },
    verification,
    params,
    request
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  const { id } = params

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  let body: AccessBody

  try {
    body = await request.json()
    validateAccessBody(body)
  } catch (error) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: isErrorWithMessage(error) ? error.message : 'Unknown error'
      }
    }
  }

  try {
    await access.createAccess(id, body.permission, body.grantee, userAddress)
    return {
      status: StatusCode.CREATED,
      body: {
        ok: true
      }
    }
  } catch (error) {
    if (error instanceof DuplicatedAccessError) {
      return {
        status: StatusCode.CONFLICT,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId,
            permission: error.permission,
            grantee: error.grantee
          }
        }
      }
    } else if (error instanceof ListNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId
          }
        }
      }
    }

    throw error
  }
}

export async function getListHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists/:id'>, 'components' | 'verification' | 'params'>
): Promise<HTTPResponse<List>> {
  const {
    components: { lists: listsComponent },
    params,
    verification
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()

  const listResult = await listsComponent.getList(params.id, { userAddress })
  const list = fromDBListToList(listResult)

  if (!list.permission) {
    return {
      status: StatusCode.FORBIDDEN,
      body: {
        ok: false,
        message: 'Forbidden'
      }
    }
  }

  return {
    status: StatusCode.OK,
    body: {
      ok: true,
      data: list
    }
  }
}

export async function getListsHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists'>, 'components' | 'url' | 'verification'>
): Promise<HTTPResponse<Pick<List, 'id' | 'name'>>> {
  const {
    components: { lists: listsComponent },
    url,
    verification
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  const { limit, offset } = getPaginationParams(url.searchParams)
  const sortBy = url.searchParams.get('sortBy') as ListSortBy | undefined
  const sortDirection = url.searchParams.get('sortDirection') as ListSortDirection | undefined

  if (sortBy && !Object.values(ListSortBy).includes(sortBy)) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: 'The sort by parameter is not defined as date or name.'
      }
    }
  }

  if (sortDirection && !Object.values(ListSortDirection).includes(sortDirection)) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: 'The sort direction parameter is not defined as asc or desc.'
      }
    }
  }

  const listsResult = await listsComponent.getLists({
    userAddress,
    limit,
    offset,
    sortBy,
    sortDirection
  })
  const { lists, count } = fromDBGetListsToListsWithCount(listsResult)

  return {
    status: StatusCode.OK,
    body: {
      ok: true,
      data: {
        results: lists,
        total: lists.length > 0 ? count : 0,
        page: Math.floor(offset / limit),
        pages: lists.length > 0 ? Math.ceil(count / limit) : 0,
        limit
      }
    }
  }
}

export async function createListHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists'>, 'components' | 'request' | 'verification'>
): Promise<HTTPResponse<List>> {
  const {
    components: { lists },
    verification,
    request
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  let body: AddListRequestBody

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  try {
    body = await request.json()
    if (!body.name || (body.name && typeof body.name !== 'string')) {
      return {
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property name is missing or is not of string type.'
        }
      }
    }
  } catch (error) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: 'The body must contain a parsable JSON.'
      }
    }
  }

  try {
    const addListResult = await lists.addList({ name: body.name, userAddress })
    return {
      status: StatusCode.CREATED,
      body: {
        ok: true,
        data: fromDBListToList(addListResult)
      }
    }
  } catch (error) {
    if (error instanceof DuplicatedListError) {
      return {
        status: StatusCode.UNPROCESSABLE_CONTENT,
        body: {
          ok: false,
          message: error.message,
          data: {
            name: error.name
          }
        }
      }
    }

    throw error
  }
}

export async function deleteListHandler(
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists/:id'>, 'components' | 'params' | 'request' | 'verification'>
): Promise<HTTPResponse<undefined>> {
  const {
    components: { lists },
    verification,
    params
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  const { id } = params

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: 'Unauthorized'
      }
    }
  }

  try {
    await lists.deleteList(id, userAddress)
    return {
      status: StatusCode.OK,
      body: {
        ok: true,
        data: undefined
      }
    }
  } catch (error) {
    if (error instanceof ListNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId
          }
        }
      }
    }

    throw error
  }
}
