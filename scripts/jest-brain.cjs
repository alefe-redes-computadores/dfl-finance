module.exports = {
 rootDir: '..', testEnvironment: 'node',
 testMatch: ['<rootDir>/src/__tests__/financialBrainV85.test.ts'],
 moduleNameMapper: {'^@/(.*)$':'<rootDir>/src/$1'},
 transform: {'^.+\\.tsx?$':'<rootDir>/scripts/ts-financial-transform.cjs'},
}
