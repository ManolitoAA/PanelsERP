// Envío de pedidos: lógica pura (se prueba con node --test).
export const SHIPPING_STATUSES = ['en curso', 'enviado', 'entregado'];

export const STATUS_TONE = { 'en curso': 'lead', enviado: 'enviado', entregado: 'cliente' };

const fold = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Busca por cliente, tracking, mensajería o número de pedido (#12 o 12).
export function matchesOrder(order, clientName, query) {
  const q = fold(query).trim().replace(/^#/, '');
  if (!q) return true;
  return [clientName, order.tracking_code, order.courier_name, String(order.id)].some(v => fold(v).includes(q));
}
