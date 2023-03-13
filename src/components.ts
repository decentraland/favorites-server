import path from "path"
import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createServerComponent, createStatusCheckComponent } from "@well-known-components/http-server"
import { createLogComponent } from "@well-known-components/logger"
import { createFetchComponent } from "./ports/fetch"
import { createMetricsComponent } from "@well-known-components/metrics"
import { createPgComponent } from "@well-known-components/pg-component"
import { AppComponents, GlobalContext } from "./types"
import { metricDeclarations } from "./metrics"
import { createListsComponent } from "./ports/lists/component"
import { createSubgraphComponent } from "@well-known-components/thegraph-component"

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: [".env.default", ".env"] })
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const logs = await createLogComponent({ metrics })

  let databaseUrl: string | undefined = await config.getString("PG_COMPONENT_PSQL_CONNECTION_STRING")
  const COLLECTIONS_SUBGRAPH_URL = await config.requireString("COLLECTIONS_SUBGRAPH_URL")

  if (!databaseUrl) {
    const dbUser = await config.requireString("PG_COMPONENT_PSQL_USER")
    const dbDatabaseName = await config.requireString("PG_COMPONENT_PSQL_DATABASE")
    const dbPort = await config.requireString("PG_COMPONENT_PSQL_PORT")
    const dbHost = await config.requireString("PG_COMPONENT_PSQL_HOST")
    const dbPassword = await config.requireString("PG_COMPONENT_PSQL_PASSWORD")

    databaseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabaseName}`
  }
  const schema = await config.requireString("PG_COMPONENT_PSQL_SCHEMA")

  const pg = await createPgComponent(
    { logs, config, metrics },
    {
      migration: {
        databaseUrl,
        schema,
        dir: path.resolve(__dirname, "migrations"),
        migrationsTable: "pgmigrations",
        ignorePattern: ".*\\.map",
        direction: "up",
      },
    }
  )

  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const statusChecks = await createStatusCheckComponent({ server, config })
  const fetch = await createFetchComponent()
  const collectionsSubgraph = await createSubgraphComponent({ logs, config, fetch, metrics }, COLLECTIONS_SUBGRAPH_URL)
  const lists = await createListsComponent({ pg, collectionsSubgraph })

  return {
    config,
    collectionsSubgraph,
    logs,
    server,
    statusChecks,
    fetch,
    metrics,
    pg,
    lists,
  }
}
