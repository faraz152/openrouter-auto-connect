/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/packages/core/__tests__/**/*.test.ts'],
};
