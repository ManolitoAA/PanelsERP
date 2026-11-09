import { test } from '@playwright/test';

// Capturas para revisión visual: npm run test:e2e -- screenshots (no es una prueba funcional).
test.skip(!process.env.SHOTS, 'solo con SHOTS=1');

for (const [name, size] of [['desktop', { width: 1280, height: 800 }], ['movil', { width: 375, height: 812 }]] as const) {
  test(`capturas ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.screenshot({ path: `test-results/shots/${name}-login.png` });
    await page.fill('input[name="email"]', 'jefe@panelserp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
    await page.waitForSelector('[data-testid="stat-facturado"]');
    await page.screenshot({ path: `test-results/shots/${name}-dashboard.png`, fullPage: true });
    for (const p of ['clients', 'orders', 'templates']) {
      await page.goto(`/${p}`);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `test-results/shots/${name}-${p}.png`, fullPage: true });
    }
  });
}
