import { defineConfig, devices } from '@playwright/test';

const DB = 'sqlite:///./e2e.db';

export default defineConfig({
  testDir: '../e2e',
  timeout: 30000,
  workers: 1,
  use: { headless: true, baseURL: 'http://localhost:4322' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `rm -f e2e.db && ../.venv/bin/python -m src.seed && ../.venv/bin/uvicorn src.main:app --port 8001`,
      cwd: '../backend',
      env: { DATABASE_URL: DB, SECRET_KEY: 'e2e-only-secret-at-least-32-bytes-long', GEMINI_FAKE_CATALOG: 'tests/fixtures/catalog_draft.json' },
      url: 'http://localhost:8001/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 4322',
      env: { PUBLIC_API_URL: 'http://localhost:8001' },
      url: 'http://localhost:4322',
      reuseExistingServer: false,
    },
  ],
});
