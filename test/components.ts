// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { ILoggerComponent } from '@well-known-components/interfaces'
import {
  createRunner,
  createLocalFetchCompoment
} from '@well-known-components/test-helpers'
import {
  instrumentHttpServerWithRequestLogger,
  Verbosity
} from '@well-known-components/http-requests-logger-component'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createLogComponent } from '@well-known-components/logger'
import { createServerComponent } from '@well-known-components/http-server'
import { createTracerComponent } from '@well-known-components/tracer-component'
import {
  createSubgraphComponent,
  ISubgraphComponent
} from '@well-known-components/thegraph-component'
import {
  createPgComponent,
  IPgComponent
} from '@well-known-components/pg-component'
import { createFetchComponent } from '../src/ports/fetch'
import {
  createSnapshotComponent,
  ISnapshotComponent
} from '../src/ports/snapshot'
import { createListsComponent, IListsComponents } from '../src/ports/lists'
import { createPicksComponent, IPicksComponent } from '../src/ports/picks'
import { metricDeclarations } from '../src/metrics'
import { main } from '../src/service'
import { GlobalContext, TestComponents } from '../src/types'

// start TCP port for listeners
const lastUsedPort = 19000 + parseInt(process.env.JEST_WORKER_ID || '1') * 1000
function getFreePort() {
  return lastUsedPort + 1
}

/**
 * Behaves like Jest "describe" function, used to describe a test for a
 * use case, it creates a whole new program and components to run an
 * isolated test.
 *
 * State is persistent within the steps of the test.
 */
export const test = createRunner<TestComponents>({
  main,
  initComponents
})

async function initComponents(): Promise<TestComponents> {
  const currentPort = getFreePort()
  // default config from process.env + .env file
  const defaultConfig = {
    SNAPSHOT_URL: 'https://snapshot-url.com',
    HTTP_SERVER_PORT: (currentPort + 1).toString(),
    HTTP_SERVER_HOST: 'localhost',
    COLLECTIONS_SUBGRAPH_URL: 'https://some-url.com',
    SUBGRAPH_COMPONENT_RETRIES: '0',
    PG_COMPONENT_PSQL_DATABASE: 'marketplace',
    PG_COMPONENT_PSQL_SCHEMA: 'favorites',
    PG_COMPONENT_PSQL_PORT: '5432',
    PG_COMPONENT_PSQL_HOST: 'localhost',
    PG_COMPONENT_PSQL_USER: 'username',
    PG_COMPONENT_PSQL_PASSWORD: 'password'
  }

  const config = await createDotEnvConfigComponent({}, defaultConfig)
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const tracer = createTracerComponent()
  const logs = await createLogComponent({ metrics, tracer })

  const pg = await createPgComponent({ logs, config, metrics })
  // Mock the start function to avoid connecting to a local database
  jest.spyOn(pg, 'start').mockResolvedValue()

  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    {}
  )
  const fetch = await createFetchComponent({ tracer })
  instrumentHttpServerWithRequestLogger(
    { server, logger: logs },
    { verbosity: Verbosity.INFO }
  )
  const collectionsSubgraph = await createSubgraphComponent(
    { logs, config, fetch, metrics },
    'subgraph-url'
  )
  const snapshot = await createSnapshotComponent({ fetch, config })
  const lists = createListsComponent({
    pg,
    collectionsSubgraph,
    snapshot,
    logs
  })
  const picks = createPicksComponent({ pg })

  return {
    config,
    snapshot,
    metrics,
    logs,
    pg,
    server,
    fetch,
    lists,
    picks,
    collectionsSubgraph,
    localFetch: await createLocalFetchCompoment(config)
  }
}

export function createTestLogsComponent(
  { getLogger = jest.fn() } = { getLogger: jest.fn() }
): ILoggerComponent {
  return {
    getLogger
  }
}

export function createTestPicksComponent(
  { getPicksStats = jest.fn(), getPicksByItemId = jest.fn() } = {
    getPicksStats: jest.fn(),
    getPicksByItemId: jest.fn()
  }
): IPicksComponent {
  return {
    getPicksStats,
    getPicksByItemId
  }
}

export function createTestSnapshotComponent(
  { getScore = jest.fn() } = { getScore: jest.fn() }
): ISnapshotComponent {
  return {
    getScore
  }
}

export function createTestListsComponent(
  {
    getPicksByListId = jest.fn(),
    addPickToList = jest.fn(),
    deletePickInList = jest.fn()
  } = {
    getPicksByListId: jest.fn(),
    addPickToList: jest.fn(),
    deletePickInList: jest.fn()
  }
): IListsComponents {
  return {
    getPicksByListId,
    addPickToList,
    deletePickInList
  }
}

export function createTestSubgraphComponent(
  { query = jest.fn() } = { query: jest.fn() }
): ISubgraphComponent {
  return {
    query
  }
}

export function createTestPgComponent(
  {
    query = jest.fn(),
    start = jest.fn(),
    streamQuery = jest.fn(),
    getPool = jest.fn(),
    stop = jest.fn()
  } = {
    query: jest.fn(),
    start: jest.fn(),
    streamQuery: jest.fn(),
    getPool: jest.fn(),
    stop: jest.fn()
  }
): IPgComponent {
  return {
    start,
    streamQuery,
    query,
    getPool,
    stop
  }
}
