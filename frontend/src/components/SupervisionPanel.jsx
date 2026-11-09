import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';

export default function SupervisionPanel() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/reports/billing`, { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error('No autorizado'); return r.json(); })
      .then(setRows)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  return (
    <table className="w-full text-sm text-left border-collapse">
      <thead>
        <tr className="bg-slate-100 text-slate-600 uppercase text-xs">
          <th className="px-4 py-2 border-b">Comercial</th>
          <th className="px-4 py-2 border-b text-right">Pedidos</th>
          <th className="px-4 py-2 border-b text-right">Facturado €</th>
          <th className="px-4 py-2 border-b text-right">Beneficio €</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.commercial_id} className="border-b border-slate-100">
            <td className="px-4 py-2 font-medium">{r.commercial_name}</td>
            <td className="px-4 py-2 text-right">{r.order_count}</td>
            <td className="px-4 py-2 text-right tabular-nums">{r.total_billed.toFixed(2)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{r.total_profit.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
