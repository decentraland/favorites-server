import type { IFetchComponent } from '@well-known-components/http-server'
import type * as authorizationMiddleware from 'decentraland-crypto-middleware'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
  IMetricsComponent,
  IDatabase
} from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { PaginatedResponse } from './logic/http'
import { metricDeclarations } from './metrics'
import { IListsComponents } from './ports/lists/types'
import { ISnapshotComponent } from './ports/snapshot'
import { IPicksComponent } from './ports/picks'

export type GlobalContext = {
  components: BaseComponents
}

// components used in every environment
export type BaseComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  server: IHttpServerComponent<GlobalContext>
  fetch: IFetchComponent
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
  pg: IPgComponent & IDatabase
  lists: IListsComponents
  collectionsSubgraph: ISubgraphComponent
  snapshot: ISnapshotComponent
  picks: IPicksComponent
}

// components used in runtime
export type AppComponents = BaseComponents & {
  statusChecks: IBaseComponent
}

// components used in tests
export type TestComponents = BaseComponents & {
  // A fetch component that only hits the test server
  localFetch: IFetchComponent
}

// this type simplifies the typings of http handlers
export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }> &
    authorizationMiddleware.DecentralandSignatureContext,
  Path
>

export type Context<Path extends string = any> =
  IHttpServerComponent.PathAwareContext<GlobalContext, Path>

export enum StatusCode {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  LOCKED = 423,
  CONFLICT = 409,
  ERROR = 500,
  UNPROCESSABLE_CONTENT = 422
}

export type HTTPResponse<T> = {
  status: StatusCode
  body:
    | {
        ok: false
        message: string
        data?: object
      }
    | {
        ok: true
        data?: PaginatedResponse<T>
      }
    | {
        ok: true
        data?: T
      }
}
