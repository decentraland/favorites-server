import { TPick } from "../picks"

export type PickIdsWithCount = { picks: Pick<TPick, "itemId">[]; count: number }
