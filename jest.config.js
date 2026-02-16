module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/examples/', '/implementations/', '/src/tools/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/examples/**/*',
    '!src/implementations/**/*',
    '!src/tools/**/*',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
