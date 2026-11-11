import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Empty, ErrorNote, Badge, Person, inputClass, rowClass, cellClass, moneyClass } from './ui.jsx';
import Icon from './icons.jsx';
import ShippingModal from './ShippingModal.jsx';
import { marginPct } from './format.js';
import { matchesOrder, STATUS_TONE } from './shipping.js';

const COLUMNS = [
  { label: 'Pedido' }, { label: 'Cliente' }, { label: 'Estado' }, { label: 'Envío' },
  { label: 'Facturado €', right: true }, { label: 'Beneficio €', right: true }, { label: 'Margen', right: true },
];

function ShippingCell({ order, onEdit }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(order.tracking_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex flex-col gap-1 min-w-[12rem]" data-testid={`shipping-${order.id}`}>
      {order.courier_name && <span className="font-medium text-night">{order.courier_name}</span>}
      {order.tracking_code && (
        <span className="flex items-center gap-1.5 font-mono text-xs">
          {order.tracking_url
            ? <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-accent-700 underline underline-offset-2">{order.tracking_code}</a>
            : <span className="text-slate-700">{order.tracking_code}</span>}
          <button type="button" onClick={copy} aria-label={`Copiar tracking ${order.tracking_code}`}
            className="press grid place-items-center h-7 w-7 rounded-md text-slate-500 hover:text-night hover:bg-mist">
            <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
      {order.courier_phone && (
        <a href={`tel:${order.courier_phone.replace(/\s/g, '')}`} className="font-mono text-xs text-slate-600 hover:text-accent-700">
          Atención: {order.courier_phone}
        </a>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit} className="self-start text-xs font-medium text-accent-700 hover:underline">
          {order.courier_name || order.tracking_code ? 'Editar envío' : 'Añadir envío'}
        </button>
      )}
      {!onEdit && !order.courier_name && !order.tracking_code && <span className="text-slate-400">—</span>}
    </div>
  );
}

export default function OrdersList() {
  const [orders, setOrders] = useState(null);
  const [names, setNames] = useState({});
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const readOnly = localStorage.getItem('role') === 'admin_rrhh';

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

  const nameOf = o => names[o.client_id] || `Cliente ${o.client_id}`;
  const visible = orders ? orders.filter(o => matchesOrder(o, nameOf(o), query)) : [];

  return (
    <AppShell active="orders" title="Pedidos"
      subtitle="Para crear un pedido, entra en Clientes y pulsa Nuevo pedido en su fila.">
      <Card action={orders && orders.length > 0 && (
        <input type="search" name="order-search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar cliente, tracking o nº" aria-label="Buscar pedidos" className={`${inputClass} max-w-xs`} />
      )}>
        {error && <ErrorNote>{error}</ErrorNote>}
        {!orders && !error && <Empty icon="receipt">Cargando pedidos…</Empty>}
        {orders && !orders.length && <Empty icon="receipt">Sin pedidos todavía.</Empty>}
        {orders && orders.length > 0 && !visible.length && <Empty icon="receipt">Ningún pedido coincide con «{query}».</Empty>}
        {visible.length > 0 && (
          <Table columns={COLUMNS}>
            {visible.map(o => (
              <tr key={o.id} className={rowClass}>
                <td className={`${cellClass} font-mono text-slate-600`}>#{o.id}</td>
                <td className={cellClass}><Person name={nameOf(o)} /></td>
                <td className={cellClass}><Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge></td>
                <td className={cellClass}><ShippingCell order={o} onEdit={readOnly ? null : () => setEditing(o)} /></td>
                <td className={moneyClass}>{o.total_billed.toFixed(2)}</td>
                <td className={`${moneyClass} text-emerald-700`}>{o.net_profit.toFixed(2)}</td>
                <td className={`${moneyClass} text-slate-600`}>{marginPct(o.total_billed, o.net_profit)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && (
        <ShippingModal order={editing} clientName={nameOf(editing)} onClose={() => setEditing(null)}
          onSaved={saved => { setOrders(list => list.map(o => (o.id === saved.id ? saved : o))); setEditing(null); }} />
      )}
    </AppShell>
  );
}
