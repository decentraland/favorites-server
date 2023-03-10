import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { fromDBGetPickByListIdPickToPickIdsWithCount, fromDBPickToPick } from "../../adapters/lists"
import { TPick } from "../../adapters/lists/types"
import { getPaginationParams } from "../../logic/http"
import { ItemNotFoundError, ListNotFoundError, PickAlreadyExistsError } from "../../ports/lists/errors"
import { HandlerContextWithPath, HTTPResponse, StatusCode } from "../../types"

export async function getPicksByListIdHandler(
  context: Pick<HandlerContextWithPath<"lists", "/v1/lists/:id/picks">, "url" | "components" | "params" | "request"> &
    authorizationMiddleware.DecentralandSignatureContext
): Promise<HTTPResponse<Pick<TPick, "itemId">>> {
  const {
    url,
    components: { lists },
    verification,
    params,
  } = context
  const userAddress: string | undefined = verification?.auth?.toLowerCase()

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: "Unauthorized",
      },
    }
  }

  const { limit, offset } = getPaginationParams(url.searchParams)
  const picksByListIdResult = await lists.getPicksByListId(params.id, { userAddress, limit, offset })
  const { picks, count } = fromDBGetPickByListIdPickToPickIdsWithCount(picksByListIdResult)

  return {
    status: StatusCode.OK,
    body: {
      ok: true,
      data: {
        results: picks,
        total: picks.length > 0 ? count : 0,
        page: Math.floor(offset / limit),
        pages: picks.length > 0 ? Math.ceil(count / limit) : 0,
        limit,
      },
    },
  }
}

export async function createPickInListHandler(
  context: Pick<HandlerContextWithPath<"lists", "/v1/lists/:id/picks">, "components" | "params" | "request"> &
    authorizationMiddleware.DecentralandSignatureContext
): Promise<HTTPResponse<TPick>> {
  const {
    components: { lists },
    verification,
    params,
    request,
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()
  let body: { itemId?: string }

  if (!userAddress) {
    return {
      status: StatusCode.UNAUTHORIZED,
      body: {
        ok: false,
        message: "Unauthorized",
      },
    }
  }

  try {
    body = await request.json()
    if (!body.itemId || (body.itemId && typeof body.itemId !== "string")) {
      return {
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: "The property itemId is missing or is not of string type.",
        },
      }
    }
  } catch (error) {
    return {
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: "The body must contain a parsable JSON.",
      },
    }
  }

  try {
    const picksByListIdResult = await lists.addPickToList(params.id, body.itemId, userAddress)
    return {
      status: StatusCode.CREATED,
      body: {
        ok: true,
        data: fromDBPickToPick(picksByListIdResult),
      },
    }
  } catch (error) {
    if (error instanceof ListNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId,
          },
        },
      }
    } else if (error instanceof PickAlreadyExistsError) {
      return {
        status: StatusCode.UNPROCESSABLE_CONTENT,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId: error.listId,
            itemId: error.itemId,
          },
        },
      }
    } else if (error instanceof ItemNotFoundError) {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            itemId: error.itemId,
          },
        },
      }
    }

    throw error
  }
}
