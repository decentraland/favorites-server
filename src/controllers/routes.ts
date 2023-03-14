import { Router } from "@well-known-components/http-server"
import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { GlobalContext } from "../types"
import { pingHandler } from "./handlers/ping-handler"
import { createPickInListHandler, deletePickInListHandler, getPicksByListIdHandler } from "./handlers/lists-handlers"

const FIVE_MINUTES = 5 * 60 * 1000

// We return the entire router because it will be easier to test than a whole server
export async function setupRouter(
  _globalContext: GlobalContext
): Promise<Router<GlobalContext & authorizationMiddleware.DecentralandSignatureContext>> {
  const router = new Router<GlobalContext & authorizationMiddleware.DecentralandSignatureContext>()

  router.get("/ping", pingHandler)

  router.get(
    "/v1/lists/:id/picks",
    authorizationMiddleware.wellKnownComponents({ optional: false, expiration: FIVE_MINUTES }),
    getPicksByListIdHandler
  )

  router.post(
    "/v1/lists/:id/picks",
    authorizationMiddleware.wellKnownComponents({ optional: false, expiration: FIVE_MINUTES }),
    createPickInListHandler
  )

  router.delete(
    "/v1/lists/:id/picks/:itemId",
    authorizationMiddleware.wellKnownComponents({ optional: false, expiration: FIVE_MINUTES }),
    deletePickInListHandler
  )

  return router
}
