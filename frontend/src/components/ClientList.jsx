import React, { useEffect, useState } from 'react';

import { API_BASE, authHeaders } from './api.js';

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/clients`, { headers: authHeaders() })
      .then(r => {
        if (!r.ok) throw new Error('No autorizado');
        return r.json();
      })
      .then(setClients)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500 text-sm">Cargando clientes…</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!clients.length) return <p className="text-slate-400 text-sm">Sin clientes todavía.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs">
            <th className="px-4 py-2 border-b">Nombre</th>
            <th className="px-4 py-2 border-b">Empresa</th>
            <th className="px-4 py-2 border-b">Email</th>
            <th className="px-4 py-2 border-b text-right">Facturado €</th>
            <th className="px-4 py-2 border-b text-right">Beneficio €</th>
            <th className="px-4 py-2 border-b"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-100">
              <td className="px-4 py-2 font-medium">{c.name}</td>
              <td className="px-4 py-2 text-slate-600">{c.company}</td>
              <td className="px-4 py-2 text-slate-500">{c.contact_email}</td>
              <td className="px-4 py-2 text-right tabular-nums">{c.total_billed.toFixed(2)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{c.total_profit.toFixed(2)}</td>
              <td className="px-4 py-2"><a href={`/orders?client_id=${c.id}`} className="text-blue-600 hover:underline">Nuevo pedido</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
