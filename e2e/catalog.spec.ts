import { test, expect } from '@playwright/test';

// El backend de e2e arranca con GEMINI_FAKE_CATALOG: importar cualquier PDF devuelve
// backend/tests/fixtures/catalog_draft.json (BOLARDO PCK con 2 variantes) sin llamar a Gemini.
const PDF = { name: 'catalogo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') };
const LABEL_100 = 'BOLARDO PCK 100 × 430 × 30 × 68 × 150 × 12.800';

async function login(page, email: string) {
  await page.goto('/');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

// Con SHOTS=1 deja capturas en frontend/test-results/shots/ para revisión visual.
async function shot(page, name: string) {
  if (!process.env.SHOTS) return;
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.waitForTimeout(1200);  // deja terminar las animaciones de entrada
  await page.screenshot({ path: `test-results/shots/catalogo-${name}.png`, fullPage: true });
}

async function openCatalog(page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Catálogo' }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
}

test.describe.serial('catálogo de productos', () => {
  test('comercial importa un catálogo PDF, pone precios y confirma', async ({ page }) => {
    await login(page, 'comercial1@panelserp.com');
    await openCatalog(page);
    await page.setInputFiles('input[name="catalog-file"]', PDF);
    const rows = page.getByTestId('review-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('nueva');
    await rows.nth(1).getByLabel(/^Precio de/).fill('15');
    await rows.nth(1).getByLabel(/^Coste de/).fill('9');
    await shot(page, 'revision');
    await page.getByRole('button', { name: 'Confirmar importación' }).click();
    await expect(page.getByRole('status')).toContainText('2 nuevas');
    await expect(page.getByTestId('catalog-row')).toHaveCount(2);
  });

  test('otro comercial ve conflictos sin opción de sobrescribir', async ({ page }) => {
    await login(page, 'comercial2@panelserp.com');
    await openCatalog(page);
    await page.setInputFiles('input[name="catalog-file"]', PDF);
    const rows = page.getByTestId('review-row');
    await expect(rows.nth(0)).toContainText('conflicto');
    const select = rows.nth(1).getByRole('combobox');
    await expect(select.locator('option')).toHaveText(['Elige…', 'Crear otro', 'Mantener el antiguo']);
    await expect(rows.nth(1)).toContainText('Actual: 100 × 430');
    await shot(page, 'conflictos');
    const confirm = page.getByRole('button', { name: 'Confirmar importación' });
    await expect(confirm).toBeDisabled();
    await rows.nth(0).getByRole('combobox').selectOption('mantener');
    await select.selectOption('mantener');
    await confirm.click();
    await expect(page.getByRole('status')).toContainText('2 mantenidas');
    await expect(page.getByTestId('catalog-row')).toHaveCount(2);
    await shot(page, 'listado');
  });

  test('el pedido rellena precio y coste desde la variante del catálogo', async ({ page }) => {
    await login(page, 'comercial1@panelserp.com');
    await page.goto('/orders/new');
    await page.fill('input[placeholder="Producto"]', LABEL_100);
    await page.fill('input[placeholder="Cant."]', '200');
    await expect(page.locator('input[placeholder="Precio €"]')).toHaveValue('15');
    await expect(page.locator('input[placeholder="Coste €"]')).toHaveValue('9');
    await expect(page.getByTestId('order-total')).toHaveText('3000.00 €');
    await expect(page.getByTestId('order-profit')).toHaveText('1200.00 €');
    await shot(page, 'pedido');
  });

  test('RRHH ve el catálogo pero no puede subir ni editar', async ({ page }) => {
    await login(page, 'admin@panelserp.com');
    await openCatalog(page);
    await expect(page.getByTestId('catalog-row')).toHaveCount(2);
    await expect(page.locator('input[name="catalog-file"]')).toHaveCount(0);
    await expect(page.getByTestId('catalog-row').first().locator('input')).toHaveCount(0);
  });
});
