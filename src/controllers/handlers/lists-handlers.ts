import { List, fromDBGetListsToListsWithCount, fromDBGetPickByListIdToPickIdsWithCount, fromDBPickToPick } from '../../adapters/lists'
import { TPick } from '../../adapters/picks'
import { getPaginationParams } from '../../logic/http'
import { ItemNotFoundError, ListNotFoundError, PickAlreadyExistsError, PickNotFoundError } from '../../ports/lists/errors'
import { HandlerContextWithPath, HTTPResponse, StatusCode } from '../../types'

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
  context: Pick<HandlerContextWithPath<'lists', '/v1/lists/:id/picks/:itemId'>, 'components' | 'params' | 'request' | 'verification'>
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

  const listsResult = await listsComponent.getLists({
    userAddress,
    limit,
    offset
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
