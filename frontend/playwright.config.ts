import { defineConfig, devices } from '@playwright/test';

const DB = 'sqlite:///./e2e.db';

export default defineConfig({
  testDir: '../e2e',
  timeout: 30000,
  workers: 1,
  use: { headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `rm -f e2e.db && ../.venv/bin/python -m src.seed && ../.venv/bin/uvicorn src.main:app --port 8000`,
      cwd: '../backend',
      env: { DATABASE_URL: DB },
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:4321',
      reuseExistingServer: true,
    },
  ],
});
