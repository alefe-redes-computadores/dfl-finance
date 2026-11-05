const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Backups live beside the app on Termux. They are recovery artefacts, not
  // source or test projects; indexing them makes Jest find duplicate package
  // names and, worse, can execute a stale test tree.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/', '<rootDir>/.next/',
    '<rootDir>/.dfl-backups/', '<rootDir>/DFL-.*BACKUP[^/]*/',
    '<rootDir>/tests/e2e/', '\\.d\\.ts$',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.dfl-backups/', '<rootDir>/DFL-.*BACKUP[^/]*/',
  ],
}

module.exports = createJestConfig(customJestConfig)
