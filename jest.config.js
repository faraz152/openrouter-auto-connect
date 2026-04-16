/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { resolveJsonModule: true, esModuleInterop: true } },
    ],
  },
  testMatch: ["**/packages/core/__tests__/**/*.test.ts"],
};
