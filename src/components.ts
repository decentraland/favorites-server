import path from "path"
import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createServerComponent, createStatusCheckComponent } from "@well-known-components/http-server"
import { createLogComponent } from "@well-known-components/logger"
import { createFetchComponent } from "./adapters/fetch"
import { createMetricsComponent } from "@well-known-components/metrics"
import { createPgComponent } from "@well-known-components/pg-component"
import { AppComponents, GlobalContext } from "./types"
import { metricDeclarations } from "./metrics"

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: [".env.default", ".env"] })
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const logs = await createLogComponent({ metrics })

  let databaseUrl: string | undefined = await config.getString("PG_COMPONENT_PSQL_CONNECTION_STRING")

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

  return {
    config,
    logs,
    server,
    statusChecks,
    fetch,
    metrics,
    pg,
  }
}
