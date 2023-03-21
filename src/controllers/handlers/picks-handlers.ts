import { fromDBGetPickByItemIdToPickUserAddressesWithCount, TPick } from "../../adapters/picks"
import { getNumberParameter, getPaginationParams } from "../../logic/http"
import { InvalidParameterError } from "../../logic/http/errors"
import { PickStats } from "../../ports/picks"
import { HandlerContextWithPath, HTTPResponse, StatusCode } from "../../types"

export async function getPickStatsHandler(
  context: Pick<
    HandlerContextWithPath<"picks", "/v1/picks/:itemId/stats">,
    "url" | "components" | "params" | "request" | "verification"
  >
): Promise<HTTPResponse<PickStats>> {
  const {
    url,
    components: { picks },
    verification,
    params,
  } = context
  const userAddress: string | undefined = verification?.auth.toLowerCase()

  try {
    const power = getNumberParameter("power", url.searchParams)

    const pickStats = await picks.getPickStats(params.itemId, { userAddress, power: power ?? undefined })

    return {
      status: StatusCode.OK,
      body: {
        ok: true,
        data: pickStats,
      },
    }
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return {
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: error.message,
        },
      }
    }

    throw error
  }
}

export async function getPicksByItemIdHandler(
  context: Pick<HandlerContextWithPath<"picks", "/v1/picks/:itemId">, "url" | "components" | "params" | "request">
): Promise<HTTPResponse<Pick<TPick, "userAddress">>> {
  const {
    url,
    components: { picks },
    params,
  } = context

  const { limit, offset } = getPaginationParams(url.searchParams)
  const picksByItemIdResult = await picks.getPicksByItemId(params.itemId, { limit, offset })
  const { picks: results, count } = fromDBGetPickByItemIdToPickUserAddressesWithCount(picksByItemIdResult)

  return {
    status: StatusCode.OK,
    body: {
      ok: true,
      data: {
        results,
        total: results.length > 0 ? count : 0,
        page: Math.floor(offset / limit),
        pages: results.length > 0 ? Math.ceil(count / limit) : 0,
        limit,
      },
    },
  }
}
