import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Table, Empty, inputClass } from './ui.jsx';

const COLUMNS = [
  { label: 'Nombre' }, { label: 'Empresa' }, { label: 'Email' }, { label: 'Estado' },
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

  if (loading) return <Empty>Cargando clientes…</Empty>;
  if (error) return <p role="alert" className="text-red-600 text-sm">{error}</p>;
  if (!clients.length) return <Empty>Sin clientes todavía.</Empty>;

  return (
    <Table columns={COLUMNS}>
      {clients.map(c => (
        <tr key={c.id} className="hover:bg-slate-50">
          <td className="px-4 py-3 font-medium">{c.name}</td>
          <td className="px-4 py-3 text-slate-600">{c.company}</td>
          <td className="px-4 py-3 text-slate-500">{c.contact_email}</td>
          <td className="px-4 py-3">
            {readOnly ? <span className="capitalize">{c.status}</span> : <select aria-label={`Estado de ${c.name}`} value={c.status} onChange={e => changeStatus(c.id, e.target.value)} className={inputClass}>
              <option value="lead">Lead</option>
              <option value="cliente">Cliente</option>
            </select>}
          </td>
          <td className="px-4 py-3 text-right tabular-nums">{c.total_billed.toFixed(2)}</td>
          <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{c.total_profit.toFixed(2)}</td>
          <td className="px-4 py-3">{!readOnly && <a href={`/orders/new?client_id=${c.id}`} className="text-brand-600 hover:underline font-medium">Nuevo pedido</a>}</td>
        </tr>
      ))}
    </Table>
  );
}
