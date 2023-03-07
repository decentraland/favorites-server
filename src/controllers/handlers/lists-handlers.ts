import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { fromDBGetPickByListIdPickToPicksWithCount } from "../../adapters/lists"
import { getPaginationParams } from "../../logic/http"
import { HandlerContextWithPath, HTTPResponse, StatusCode } from "../../types"

export async function getPicksByListIdHandler(
  context: Pick<HandlerContextWithPath<"lists", "/v1/lists/:id/picks">, "url" | "components" | "params" | "request"> &
    authorizationMiddleware.DecentralandSignatureContext
): Promise<HTTPResponse> {
  const {
    url,
    components: { lists },
    verification,
    params,
  } = context
  const userAddress: string | undefined = verification?.auth

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
  const { picks, count } = fromDBGetPickByListIdPickToPicksWithCount(picksByListIdResult)

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
