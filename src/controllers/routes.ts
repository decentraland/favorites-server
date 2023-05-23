import { Router } from '@well-known-components/http-server'
import * as authorizationMiddleware from 'decentraland-crypto-middleware'
import { GlobalContext } from '../types'
import {
  createPickInListHandler,
  deletePickInListHandler,
  getPicksByListIdHandler,
  deleteAccessHandler,
  createListHandler,
  deleteListHandler,
  getListsHandler,
  createAccessHandler,
  getListHandler
} from './handlers/lists-handlers'
import { getPickStatsHandler, getPicksByItemIdHandler, getPickStatsOfItemHandler } from './handlers/picks-handlers'
import { pingHandler } from './handlers/ping-handler'

const FIVE_MINUTES = 5 * 60 * 1000

export function setupRouter(_globalContext: GlobalContext): Promise<Router<GlobalContext>> {
  const router = new Router<GlobalContext>()

  router.get('/ping', pingHandler)

  router.get(
    '/v1/lists/:id/picks',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    getPicksByListIdHandler
  )

  router.post(
    '/v1/lists/:id/picks',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    createPickInListHandler
  )

  router.delete(
    '/v1/lists/:id/picks/:itemId',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    deletePickInListHandler
  )

  router.get(
    '/v1/picks/:itemId/stats',
    authorizationMiddleware.wellKnownComponents({
      optional: true,
      expiration: FIVE_MINUTES
    }),
    getPickStatsOfItemHandler
  )

  router.get('/v1/picks/stats', getPickStatsHandler)

  router.get(
    '/v1/picks/:itemId',
    authorizationMiddleware.wellKnownComponents({
      optional: true,
      expiration: FIVE_MINUTES
    }),
    getPicksByItemIdHandler
  )

  router.get(
    '/v1/lists/:id',
    authorizationMiddleware.wellKnownComponents({
      optional: true,
      expiration: FIVE_MINUTES
    }),
    getListHandler
  )

  router.get(
    '/v1/lists',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    getListsHandler
  )

  router.post(
    '/v1/lists',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    createListHandler
  )

  router.post(
    '/v1/lists/:id/access',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    createAccessHandler
  )

  router.delete(
    '/v1/lists/:id/access',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    deleteAccessHandler
  )

  router.delete(
    '/v1/lists/:id',
    authorizationMiddleware.wellKnownComponents({
      optional: false,
      expiration: FIVE_MINUTES
    }),
    deleteListHandler
  )

  return Promise.resolve(router)
}
