import { test } from '@playwright/test';

// Capturas para revisión visual: npm run test:e2e -- screenshots (no es una prueba funcional).
test.skip(!process.env.SHOTS, 'solo con SHOTS=1');

// Espera a que terminen las entradas y oculta la barra de herramientas de Astro dev.
async function settle(page) {
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.waitForTimeout(1200);
}

for (const [name, size] of [['desktop', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]] as const) {
  test(`capturas ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: `test-results/shots/${name}-login.png` });
    await page.fill('input[name="email"]', 'jefe@panelserp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
    await page.waitForSelector('[data-testid="stat-facturado"]');
    await settle(page);
    await page.screenshot({ path: `test-results/shots/${name}-dashboard.png`, fullPage: true });
    for (const p of ['clients', 'orders', 'orders/new?client_id=1', 'suppliers', 'templates']) {
      await page.goto(`/${p}`);
      await settle(page);
      await page.screenshot({ path: `test-results/shots/${name}-${p.split('?')[0].replace('/', '-')}.png`, fullPage: true });
    }
  });
}
