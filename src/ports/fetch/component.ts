import { IFetchComponent } from "@well-known-components/http-server"
import { ITracerComponent } from "@well-known-components/interfaces"
import * as nodeFetch from "node-fetch"

export async function createFetchComponent(components: { tracer: ITracerComponent }) {
  const { tracer } = components
  const fetch: IFetchComponent = {
    async fetch(url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit): Promise<nodeFetch.Response> {
      const headers: nodeFetch.HeadersInit = { ...init?.headers } as {
        [key: string]: string
      }
      const traceParent = tracer.isInsideOfTraceSpan() ? tracer.getTraceChildString() : null
      if (traceParent) {
        headers.traceparent = traceParent
        const traceState = tracer.getTraceStateString()
        if (traceState) {
          headers.tracestate = traceState
        }
      }
      return nodeFetch.default(url, { ...init, headers })
    },
  }

  return fetch
}
