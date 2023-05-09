// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment
import path from 'node:path'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { instrumentHttpServerWithRequestLogger, Verbosity } from '@well-known-components/http-requests-logger-component'
import { createServerComponent } from '@well-known-components/http-server'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createPgComponent, IPgComponent } from '@well-known-components/pg-component'
import { createRunner, createLocalFetchCompoment } from '@well-known-components/test-helpers'
import { createSubgraphComponent, ISubgraphComponent } from '@well-known-components/thegraph-component'
import { createTracerComponent } from '@well-known-components/tracer-component'
import { metricDeclarations } from '../src/metrics'
import { createAccessComponent, IAccessComponent } from '../src/ports/access'
import { createFetchComponent } from '../src/ports/fetch'
import { createListsComponent, IListsComponents } from '../src/ports/lists'
import { createPicksComponent, IPicksComponent } from '../src/ports/picks'
import { createSnapshotComponent, ISnapshotComponent } from '../src/ports/snapshot'
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
    HTTP_SERVER_PORT: (currentPort + 1).toString()
  }

  const config = await createDotEnvConfigComponent({ path: path.resolve(__dirname, '../.env.default') }, defaultConfig)
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const tracer = createTracerComponent()
  const logs = await createLogComponent({ metrics, tracer })

  const pg = await createPgComponent({ logs, config, metrics })
  // Mock the start function to avoid connecting to a local database
  jest.spyOn(pg, 'start').mockResolvedValue()

  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const fetch = await createFetchComponent({ tracer })
  const access = createAccessComponent({ pg, logs })
  instrumentHttpServerWithRequestLogger({ server, logger: logs }, { verbosity: Verbosity.INFO })
  const collectionsSubgraph = await createSubgraphComponent({ logs, config, fetch, metrics }, 'subgraph-url')
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
    localFetch: await createLocalFetchCompoment(config),
    access
  }
}

export function createTestLogsComponent({ getLogger = jest.fn() } = { getLogger: jest.fn() }): ILoggerComponent {
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

export function createTestSnapshotComponent({ getScore = jest.fn() } = { getScore: jest.fn() }): ISnapshotComponent {
  return {
    getScore
  }
}

export function createTestListsComponent(
  {
    getPicksByListId = jest.fn(),
    addPickToList = jest.fn(),
    deletePickInList = jest.fn(),
    getLists = jest.fn(),
    addList = jest.fn(),
    deleteList = jest.fn()
  } = {
    getPicksByListId: jest.fn(),
    addPickToList: jest.fn(),
    deletePickInList: jest.fn(),
    getLists: jest.fn(),
    addList: jest.fn(),
    deleteList: jest.fn()
  }
): IListsComponents {
  return {
    getPicksByListId,
    addPickToList,
    deletePickInList,
    getLists,
    addList,
    deleteList
  }
}

export function createTestAccessComponent({ deleteAccess = jest.fn() } = { deleteAccess: jest.fn() }): IAccessComponent {
  return {
    deleteAccess
  }
}

export function createTestSubgraphComponent({ query = jest.fn() } = { query: jest.fn() }): ISubgraphComponent {
  return {
    query
  }
}

export function createTestPgComponent(
  { query = jest.fn(), start = jest.fn(), streamQuery = jest.fn(), getPool = jest.fn(), stop = jest.fn() } = {
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
