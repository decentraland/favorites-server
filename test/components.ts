// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { createRunner, createLocalFetchCompoment } from "@well-known-components/test-helpers"
import { instrumentHttpServerWithRequestLogger, Verbosity } from "@well-known-components/http-requests-logger-component"
import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createMetricsComponent } from "@well-known-components/metrics"
import { createLogComponent } from "@well-known-components/logger"
import { createServerComponent } from "@well-known-components/http-server"
import { createTracerComponent } from "@well-known-components/tracer-component"
import { createPgComponent, IPgComponent } from "@well-known-components/pg-component"
import { createFetchComponent } from "../src/ports/fetch"
import { createListsComponent, IListsComponents } from "../src/ports/lists"
import { metricDeclarations } from "../src/metrics"
import { main } from "../src/service"
import { GlobalContext, TestComponents } from "../src/types"

// start TCP port for listeners
let lastUsedPort = 19000 + parseInt(process.env.JEST_WORKER_ID || "1") * 1000
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
  initComponents,
})

async function initComponents(): Promise<TestComponents> {
  process.env.HTTP_SERVER_PORT = (getFreePort() + 1).toString()

  // default config from process.env + .env file
  const config = await createDotEnvConfigComponent({ path: [".env.spec"] }, process.env)
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const tracer = createTracerComponent()
  const logs = await createLogComponent({ metrics, tracer })

  const pg = await createPgComponent({ logs, config, metrics })
  // Mock the start function to avoid connecting to a local database
  jest.spyOn(pg, "start").mockResolvedValue()

  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const fetch = await createFetchComponent({ tracer })
  instrumentHttpServerWithRequestLogger({ server, logger: logs }, { verbosity: Verbosity.INFO })

  const lists = await createListsComponent({ pg })

  return {
    config,
    metrics,
    logs,
    pg,
    server,
    fetch,
    lists,
    localFetch: await createLocalFetchCompoment(config),
  }
}

export function createTestListsComponent(
  { getPicksByListId = jest.fn() } = {
    getPicksByListId: jest.fn(),
  }
): IListsComponents {
  return {
    getPicksByListId,
  }
}

export function createTestPgComponent(
  { query = jest.fn(), start = jest.fn(), streamQuery = jest.fn(), getPool = jest.fn(), stop = jest.fn() } = {
    query: jest.fn(),
    start: jest.fn(),
    streamQuery: jest.fn(),
    getPool: jest.fn(),
    stop: jest.fn(),
  }
): IPgComponent {
  return {
    start,
    streamQuery,
    query,
    getPool,
    stop,
  }
}
