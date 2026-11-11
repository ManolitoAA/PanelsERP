import { test, expect } from '@playwright/test';

// Envío de pedidos: alta de mensajería, tracking en el pedido y búsqueda (backend e2e en :8001).
const API = 'http://localhost:8001';

test('comercial añade mensajería y tracking a un pedido en curso', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="email"]', 'comercial1@panelserp.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // cliente y pedido propios por API, para no depender de otras pruebas
  const orderId = await page.evaluate(async api => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
    const client = await (await fetch(`${api}/api/clients`, { method: 'POST', headers,
      body: JSON.stringify({ name: 'Ines', company: 'Envios Test SL', contact_email: 'ines@envios.test', status: 'cliente' }) })).json();
    const order = await (await fetch(`${api}/api/orders`, { method: 'POST', headers,
      body: JSON.stringify({ client_id: client.id, items: [{ product_name: 'Perfil', quantity: 1, unit_price: 10, unit_cost: 5 }] }) })).json();
    return order.id;
  }, API);

  await page.goto('/orders');
  const row = page.locator('tr', { has: page.getByTestId(`shipping-${orderId}`) });
  await expect(row.getByText('en curso')).toBeVisible();
  await row.getByRole('button', { name: 'Añadir envío' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Nueva mensajería' }).click();
  if (process.env.SHOTS) await page.screenshot({ path: 'test-results/shots/desktop-shipping-modal.png' });
  await dialog.locator('input[name="courier-name"]').fill('Mensajeria E2E');
  await dialog.locator('input[name="courier-phone"]').fill('900 111 222');
  await dialog.locator('input[name="courier-url"]').fill('https://track.example/?id={tracking}');
  await dialog.getByRole('button', { name: 'Añadir mensajería' }).click();
  await expect(dialog.locator('select[name="courier"]')).toHaveValue(/\d+/);
  await dialog.locator('input[name="tracking"]').fill('ZX 99/1');
  await dialog.getByRole('button', { name: 'Guardar envío' }).click();
  await expect(dialog).toHaveCount(0);

  await expect(row.getByText('enviado')).toBeVisible();
  await expect(row.getByRole('link', { name: 'ZX 99/1' })).toHaveAttribute('href', 'https://track.example/?id=ZX%2099%2F1');
  await expect(row.getByRole('link', { name: /900 111 222/ })).toHaveAttribute('href', 'tel:900111222');

  if (process.env.SHOTS) await page.screenshot({ path: 'test-results/shots/desktop-orders-shipping.png', fullPage: true });

  // al llamar el cliente: se busca por tracking
  await page.getByLabel('Buscar pedidos').fill('zx 99');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Buscar pedidos').fill('no-existe');
  await expect(page.getByText('Ningún pedido coincide')).toBeVisible();

  // la mensajería queda en Proveedores para reutilizarla
  await page.goto('/suppliers');
  await expect(page.locator('tr', { hasText: 'Mensajeria E2E' })).toContainText('900 111 222');
});
