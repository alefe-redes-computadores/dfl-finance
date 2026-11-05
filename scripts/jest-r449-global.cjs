module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.[jt]s',
    '<rootDir>/src/__tests__/**/*.test.[jt]sx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss|sass)$':
      '<rootDir>/node_modules/next/dist/build/jest/__mocks__/styleMock.js',
    '\\.(svg|png|jpg|jpeg|webp)$':
      '<rootDir>/node_modules/next/dist/build/jest/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.[jt]sx?$':
      '<rootDir>/scripts/ts-r449-jest-transform.cjs',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/.dfl-backups/',
    '/tests/e2e/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.dfl-backups/',
    '<rootDir>/DFL-.*-BACKUP-',
  ],
}
