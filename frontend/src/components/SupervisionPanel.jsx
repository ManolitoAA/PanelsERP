import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Table, Person, rowClass, cellClass, moneyClass } from './ui.jsx';
import { marginPct } from './format.js';

const COLUMNS = [
  { label: 'Comercial' }, { label: 'Pedidos', right: true },
  { label: 'Facturado €', right: true }, { label: 'Beneficio €', right: true }, { label: 'Margen', right: true },
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

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  const top = Math.max(1, ...rows.map(r => r.total_billed));
  return (
    <Table columns={COLUMNS}>
      {rows.map(r => (
        <tr key={r.commercial_id} className={rowClass}>
          <td className={cellClass}><Person name={r.commercial_name} /></td>
          <td className={moneyClass}>{r.order_count}</td>
          <td className={moneyClass}>
            {r.total_billed.toFixed(2)}
            <span aria-hidden="true" className="mt-1.5 ml-auto block h-1 max-w-[120px] rounded-full bg-mist overflow-hidden">
              <span className="block h-full rounded-full bg-accent-500" style={{ width: `${(r.total_billed / top) * 100}%` }} />
            </span>
          </td>
          <td className={`${moneyClass} text-emerald-700`}>{r.total_profit.toFixed(2)}</td>
          <td className={`${moneyClass} text-slate-600`}>{marginPct(r.total_billed, r.total_profit)}</td>
        </tr>
      ))}
    </Table>
  );
}
