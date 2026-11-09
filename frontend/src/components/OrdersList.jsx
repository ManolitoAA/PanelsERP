import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Empty } from './ui.jsx';

const COLUMNS = [
  { label: 'Pedido' }, { label: 'Cliente' }, { label: 'Estado' },
  { label: 'Facturado €', right: true }, { label: 'Beneficio €', right: true },
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
    <AppShell active="orders" title="Pedidos">
      <Card>
        {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
        {orders && !orders.length && <Empty>Sin pedidos todavía.</Empty>}
        {orders && orders.length > 0 && (
          <Table columns={COLUMNS}>
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">#{o.id}</td>
                <td className="px-4 py-3 font-medium">{names[o.client_id] || `Cliente ${o.client_id}`}</td>
                <td className="px-4 py-3 capitalize">{o.status}</td>
                <td className="px-4 py-3 text-right tabular-nums">{o.total_billed.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{o.net_profit.toFixed(2)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
