const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./test/e2e",
  timeout: 180000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure" },
  outputDir: "test-results",
});
