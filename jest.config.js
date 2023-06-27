export default {
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', 'index.ts', 'src/migrations'],
  testMatch: ['**/*.spec.(ts)'],
  testEnvironment: 'node',
  resetMocks: true,
  setupFilesAfterEnv: ['./jest.setup.ts']
}
