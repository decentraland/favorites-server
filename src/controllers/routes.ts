import { Router } from "@well-known-components/http-server"
import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { GlobalContext } from "../types"
import { pingHandler } from "./handlers/ping-handler"
import { getPicksByListIdHandler } from "./handlers/lists-handlers"

// We return the entire router because it will be easier to test than a whole server
export async function setupRouter(
  _globalContext: GlobalContext
): Promise<Router<GlobalContext & authorizationMiddleware.DecentralandSignatureContext>> {
  const router = new Router<GlobalContext & authorizationMiddleware.DecentralandSignatureContext>()

  router.get("/ping", pingHandler)

  router.get(
    "/v1/lists/:id/picks",
    authorizationMiddleware.wellKnownComponents({ optional: false, expiration: 5 * 60 * 1000 }),
    getPicksByListIdHandler
  )

  return router
}
