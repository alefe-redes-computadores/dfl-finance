const base = require('./jest-financial.cjs')
module.exports = {
  ...base,
  testMatch: [
    '<rootDir>/src/__tests__/financialIntegrityV84.test.ts',
    '<rootDir>/src/__tests__/financialSurgeryR115.test.ts',
  ],
  maxWorkers: 1,
}
