import { defineConfig } from "@playwright/test";
import fs from "node:fs";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.ATLAS_TEST_URL || "http://127.0.0.1:3210",
    viewport: { width: 1512, height: 982 },
    launchOptions: fs.existsSync(chrome) ? { executablePath: chrome } : {},
    trace: "retain-on-failure",
  },
  reporter: "list",
});
