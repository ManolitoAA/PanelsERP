import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Table, Empty, ErrorNote, Badge, Person, inputClass, rowClass, cellClass, moneyClass } from './ui.jsx';
import Icon from './icons.jsx';

const COLUMNS = [
  { label: 'Nombre' }, { label: 'Email' }, { label: 'Estado' },
  { label: 'Facturado €', right: true }, { label: 'Beneficio €', right: true }, { label: '' },
];

export default function ClientList({ status = '' }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const readOnly = localStorage.getItem('role') === 'admin_rrhh';

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/clients${status ? `?status=${status}` : ''}`, { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error('No autorizado'); return r.json(); })
      .then(setClients)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [status]);

  async function changeStatus(id, newStatus) {
    const res = await fetch(`${API_BASE}/api/clients/${id}`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return setError('No se pudo cambiar el estado');
    setClients(cs => (status && status !== newStatus ? cs.filter(c => c.id !== id) : cs.map(c => (c.id === id ? { ...c, status: newStatus } : c))));
  }

  if (loading) return <Empty icon="users">Cargando clientes…</Empty>;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!clients.length) return <Empty icon="users">Sin clientes todavía. Registra el primero arriba.</Empty>;

  return (
    <Table columns={COLUMNS}>
      {clients.map(c => (
        <tr key={c.id} className={rowClass}>
          <td className={cellClass}><Person name={c.name} sub={c.company} /></td>
          <td className={`${cellClass} text-slate-600`}>{c.contact_email}</td>
          <td className={cellClass}>
            {readOnly ? <Badge tone={c.status}>{c.status}</Badge> : (
              <select aria-label={`Estado de ${c.name}`} value={c.status} onChange={e => changeStatus(c.id, e.target.value)}
                className={`${inputClass} w-auto min-h-[36px] ${c.status === 'cliente' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <option value="lead">Lead</option>
                <option value="cliente">Cliente</option>
              </select>
            )}
          </td>
          <td className={moneyClass}>{c.total_billed.toFixed(2)}</td>
          <td className={`${moneyClass} text-emerald-700`}>{c.total_profit.toFixed(2)}</td>
          <td className={`${cellClass} text-right`}>
            {!readOnly && (
              <a href={`/orders/new?client_id=${c.id}`}
                className="press inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 min-h-[36px] text-sm font-medium text-accent-700 hover:bg-accent-50">
                Nuevo pedido<Icon name="arrow" className="h-3.5 w-3.5" />
              </a>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}
