import { IFetchComponent } from '@well-known-components/http-server'
import { IConfigComponent } from '@well-known-components/interfaces'
import { createSnapshotComponent, ISnapshotComponent } from '../../src/ports/snapshot'
import { ScoreError } from '../../src/ports/snapshot/errors'

let snapshotComponent: ISnapshotComponent
let fetchComponent: IFetchComponent
let configComponent: IConfigComponent
let mockedRequireString: jest.Mock
let mockedFetch: jest.Mock

beforeEach(async () => {
  mockedRequireString = jest.fn()
  mockedFetch = jest.fn()
  fetchComponent = { fetch: mockedFetch }
  configComponent = {
    getString: jest.fn(),
    getNumber: jest.fn(),
    requireString: mockedRequireString,
    requireNumber: jest.fn()
  }
  snapshotComponent = await createSnapshotComponent({
    config: configComponent,
    fetch: fetchComponent
  })
})

describe("when getting the user's score", () => {
  const address = '0xa3D963609EEaA7aA796c81E8c6f945c601f9BEc7'
  const snapshotURL = 'http://snapshot-url.com'
  beforeEach(() => {
    mockedRequireString.mockResolvedValueOnce(snapshotURL)
  })

  describe('and the request to snapshot fails', () => {
    beforeEach(() => {
      mockedFetch.mockRejectedValueOnce(new Error('An error occurred'))
    })

    it('should throw a score error with the reason', () => {
      return expect(snapshotComponent.getScore(address)).rejects.toEqual(new ScoreError('An error occurred', address))
    })
  })

  describe('and the request to snapshot is successful', () => {
    describe('and the response does not contain the voting power', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ result: {} })
        })
      })

      it('should resolve the voting power as 0', () => {
        return expect(snapshotComponent.getScore(address)).resolves.toEqual(0)
      })
    })

    describe('and the response contains the voting power', () => {
      const vp = 10
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ result: { vp } })
        })
      })

      it('should resolve the voting power of the user', () => {
        return expect(snapshotComponent.getScore(address)).resolves.toEqual(vp)
      })
    })
  })
})
