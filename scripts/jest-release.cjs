module.exports = {
 rootDir: '..', testEnvironment: 'node',
 testMatch: ['<rootDir>/src/__tests__/financialIntegrityV84.test.ts','<rootDir>/src/__tests__/financialBrainV85.test.ts','<rootDir>/src/__tests__/dailyProductV86.test.ts'],
 moduleNameMapper: {'^@/(.*)$':'<rootDir>/src/$1'},
 transform: {'^.+\\.tsx?$':'<rootDir>/scripts/ts-financial-transform.cjs'},
}
