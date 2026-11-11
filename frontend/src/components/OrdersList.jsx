import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Empty, ErrorNote, Badge, Person, rowClass, cellClass, moneyClass } from './ui.jsx';
import { marginPct } from './format.js';

const COLUMNS = [
  { label: 'Pedido' }, { label: 'Cliente' }, { label: 'Estado' },
  { label: 'Facturado €', right: true }, { label: 'Beneficio €', right: true }, { label: 'Margen', right: true },
];

export default function OrdersList() {
  const [orders, setOrders] = useState(null);
  const [names, setNames] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/orders`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/clients`, { headers: authHeaders() }),
    ])
      .then(async ([o, c]) => {
        if (!o.ok || !c.ok) throw new Error('No se pudieron cargar los pedidos');
        const clients = await c.json();
        setNames(Object.fromEntries(clients.map(x => [x.id, x.company])));
        setOrders(await o.json());
      })
      .catch(e => setError(e.message));
  }, []);

  return (
    <AppShell active="orders" title="Pedidos"
      subtitle="Para crear un pedido, entra en Clientes y pulsa Nuevo pedido en su fila.">
      <Card>
        {error && <ErrorNote>{error}</ErrorNote>}
        {!orders && !error && <Empty icon="receipt">Cargando pedidos…</Empty>}
        {orders && !orders.length && <Empty icon="receipt">Sin pedidos todavía.</Empty>}
        {orders && orders.length > 0 && (
          <Table columns={COLUMNS}>
            {orders.map(o => {
              const name = names[o.client_id] || `Cliente ${o.client_id}`;
              return (
                <tr key={o.id} className={rowClass}>
                  <td className={`${cellClass} font-mono text-slate-600`}>#{o.id}</td>
                  <td className={cellClass}><Person name={name} /></td>
                  <td className={cellClass}><Badge>{o.status}</Badge></td>
                  <td className={moneyClass}>{o.total_billed.toFixed(2)}</td>
                  <td className={`${moneyClass} text-emerald-700`}>{o.net_profit.toFixed(2)}</td>
                  <td className={`${moneyClass} text-slate-600`}>{marginPct(o.total_billed, o.net_profit)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
