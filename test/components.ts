// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { createRunner, createLocalFetchCompoment } from "@well-known-components/test-helpers"

import { main } from "../src/service"
import { GlobalContext, TestComponents } from "../src/types"
import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createMetricsComponent } from "@well-known-components/metrics"
import { metricDeclarations } from "../src/metrics"
import { createLogComponent } from "@well-known-components/logger"
import { createServerComponent } from "@well-known-components/http-server"
import { createFetchComponent } from "../src/adapters/fetch"
import { createPgComponent } from "@well-known-components/pg-component"

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
  const logs = await createLogComponent({ metrics })

  const pg = await createPgComponent({ logs, config, metrics })

  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const fetch = await createFetchComponent()

  return {
    config,
    metrics,
    logs,
    pg,
    server,
    fetch,
    localFetch: await createLocalFetchCompoment(config),
  }
}
