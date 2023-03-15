import { isErrorWithMessage } from "../../logic/errors"
import { AppComponents } from "../../types"
import { strategies } from "./constants"
import { ScoreError } from "./errors"
import { ISnapshotComponent, ScoreRequest, ScoreResponse } from "./types"

export async function createSnapshotComponent(
  components: Pick<AppComponents, "fetch" | "config">
): Promise<ISnapshotComponent> {
  const { fetch, config } = components
  const SNAPSHOT_URL = await config.requireString("SNAPSHOT_URL")

  async function getScore(address: string): Promise<number> {
    const data: ScoreRequest = {
      jsonrpc: "2.0",
      method: "get_vp",
      params: {
        network: "1",
        address: address.toLowerCase(),
        strategies,
        space: "snapshot.dcl.eth",
        delegation: false,
      },
    }

    try {
      const res = await fetch.fetch(SNAPSHOT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      })
      const body: ScoreResponse = await res.json()
      return (body?.result?.vp || 0) | 0
    } catch (err) {
      throw new ScoreError(isErrorWithMessage(err) ? err.message : "Unknown", address)
    }
  }

  return { getScore }
}
