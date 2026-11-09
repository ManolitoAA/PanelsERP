import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Table } from './ui.jsx';

const COLUMNS = [
  { label: 'Comercial' }, { label: 'Pedidos', right: true },
  { label: 'Facturado €', right: true }, { label: 'Beneficio €', right: true },
];

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
    <Table columns={COLUMNS}>
      {rows.map(r => (
        <tr key={r.commercial_id} className="hover:bg-slate-50">
          <td className="px-4 py-3 font-medium">{r.commercial_name}</td>
          <td className="px-4 py-3 text-right">{r.order_count}</td>
          <td className="px-4 py-3 text-right tabular-nums">{r.total_billed.toFixed(2)}</td>
          <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{r.total_profit.toFixed(2)}</td>
        </tr>
      ))}
    </Table>
  );
}
