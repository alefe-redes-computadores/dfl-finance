module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/__tests__/financialSheetsStability.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.tsx?$': '<rootDir>/scripts/ts-financial-transform.cjs' },
}
