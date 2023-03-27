import { ChainId } from '@dcl/schemas'

export const strategies = [
  {
    name: 'multichain',
    network: '1',
    params: {
      name: 'multichain',
      graphs: {
        [ChainId.MATIC_MAINNET]: 'https://api.thegraph.com/subgraphs/name/decentraland/blocks-matic-mainnet'
      },
      symbol: 'MANA',
      strategies: [
        {
          name: 'erc20-balance-of',
          params: {
            address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
            decimals: 18
          },
          network: '1'
        },
        {
          name: 'erc20-balance-of',
          params: {
            address: '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4',
            decimals: 18
          },
          network: '137'
        }
      ]
    }
  },
  {
    name: 'erc20-balance-of',
    network: '1',
    params: {
      symbol: 'WMANA',
      address: '0xfd09cf7cfffa9932e33668311c4777cb9db3c9be',
      decimals: 18
    }
  },
  {
    name: 'erc721-with-multiplier',
    network: '1',
    params: {
      symbol: 'LAND',
      address: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
      multiplier: 2000
    }
  },
  {
    name: 'decentraland-estate-size',
    network: '1',
    params: {
      symbol: 'ESTATE',
      address: '0x959e104e1a4db6317fa58f8295f586e1a978c297',
      multiplier: 2000
    }
  },
  {
    name: 'erc721-with-multiplier',
    network: '1',
    params: {
      symbol: 'NAMES',
      address: '0x2a187453064356c898cae034eaed119e1663acb8',
      multiplier: 100
    }
  }
]
