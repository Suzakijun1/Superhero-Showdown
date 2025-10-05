/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(test).js"],
  // Make long startup (Mongo/Apollo) not time out
  testTimeout: 30000,
  // --- coverage ---
  collectCoverage: true,
  collectCoverageFrom: [
    "server/**/*.js",
    "!server/**/index.js", // exclude app entry points if you want
    "!server/**/seed*.js", // exclude seeds
    "!server/**/migrations/**", // etc.
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "html", "json-summary"],
  // Optional: enforce minimums (helps your write-up)
  coverageThreshold: {
    global: { statements: 80, branches: 70, functions: 80, lines: 80 },
  },
};
