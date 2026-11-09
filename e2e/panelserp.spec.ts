import { test, expect } from '@playwright/test';

// Run with: npm run test:e2e (desde frontend/; levanta backend :8001 y frontend :4322 aislados)

test('login page renders with PanelsERP title and email/password fields', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('PanelsERP');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('login with wrong credentials shows error message', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="email"]', 'nobody@test.com');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
});

async function login(page, email: string) {
  await page.goto('/');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe.serial('flujo comercial y supervisión', () => {
  test('comercial crea cliente y pedido (Caso 1: 3.000 € / 1.200 €)', async ({ page }) => {
    await login(page, 'comercial1@panelserp.com');
    await expect(page.getByRole('heading', { name: /Mis Clientes/ })).toBeVisible();

    await page.fill('input[name="client-name"]', 'Hans');
    await page.fill('input[name="client-company"]', 'Bauhaus');
    await page.fill('input[name="client-email"]', 'hans@bauhaus.de');
    await page.click('button:has-text("Crear cliente")');
    await expect(page.locator('tr', { hasText: 'Bauhaus' })).toBeVisible();

    await page.click('a:has-text("Nuevo pedido")');
    await page.fill('input[placeholder="Producto"]', 'Perfil polietileno');
    await page.fill('input[placeholder="Cant."]', '200');
    await page.fill('input[placeholder="Precio €"]', '15');
    await page.fill('input[placeholder="Coste €"]', '9');
    const margin = page.locator('input[name="margin"]');
    await expect(margin).toHaveValue('40.0 %');
    await expect(margin).not.toBeEditable();
    await expect(page.getByText('Total: 3000.00 € · Beneficio: 1200.00 €', { exact: true })).toBeVisible();
    await page.click('button:has-text("Crear pedido")');

    await expect(page).toHaveURL(/.*dashboard/);
    const row = page.locator('tr', { hasText: 'Bauhaus' });
    await expect(row).toContainText('3000.00');
    await expect(row).toContainText('1200.00');
  });

  test('jefe ve el panel de supervisión con facturación del comercial (Caso 2)', async ({ page }) => {
    await login(page, 'jefe@panelserp.com');
    await expect(page.getByRole('heading', { name: 'Supervisión' })).toBeVisible();
    const row = page.locator('tr', { hasText: 'Comercial Uno' });
    await expect(row).toContainText('3000.00');
    await expect(row).toContainText('1200.00');
  });
});

test('la barra lateral resalta la sección activa y permite navegar', async ({ page }) => {
  await login(page, 'comercial1@panelserp.com');
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Clientes' }).click();
  await expect(page).toHaveURL(/.*clients/);
  await expect(nav.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current', 'page');
});
