import { execFileSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

const chromiumPath =
  process.env.CHROMIUM_PATH ??
  execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.browser.spec.ts",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: chromiumPath,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command:
      "PORT=4173 BASE_PATH=/ pnpm --filter @workspace/conversational-cover-letter-generator run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});