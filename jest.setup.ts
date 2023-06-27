import nock from 'nock'
// import { test } from './test/components'
// import { IDatabase } from '@well-known-components/interfaces'
// import { IPgComponent } from './src/ports/pg'

nock.disableNetConnect()

// Allow localhost connections so we can test local routes and mock servers.
nock.enableNetConnect('127.0.0.1|localhost')

// const wrapFn = (fn: () => any, pg: IPgComponent & IDatabase) => async () => {
//   const client = await pg.getPool().connect()

//   try {
//     await fn()
//     // eslint-disable-next-line no-useless-catch
//   } catch (e) {
//     // This catch is not actually useless: using try/catch/finally forces `txn.rollback()`
//     // to be called regardless of errors in the tests.
//     // Otherwise, failing tests will hang and not produce useful output
//     throw e
//   } finally {
//     await client.query('ROLLBACK')
//   }
// }

// test('Jest Setup', function ({ components }) {
//   beforeAll(async () => {
//     const { pg } = components
//     // create new object with identical props to original test/it
//     const jestIt = it
//     const patchedBase = (name: string, fn: () => any, timeout?: number) => jestIt(name, wrapFn(fn, pg), timeout)
//     const patchedOnly = (name: string, fn: () => any, timeout?: number) => jestIt.only(name, wrapFn(fn, pg), timeout)
//     Object.setPrototypeOf(patchedBase, it)
//     Object.setPrototypeOf(patchedOnly, it.only)
//     patchedBase.only = patchedOnly

//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     it = patchedBase as any
//   })
// })
