import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Card, StatCard, BarChart, Empty, inputClass } from './ui.jsx';

const eur = n => `${n.toFixed(2)} €`;

export default function StatsDashboard({ supervisor }) {
  const [commercials, setCommercials] = useState([]);
  const [commercialsError, setCommercialsError] = useState(false);
  const [selected, setSelected] = useState('');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supervisor) return;
    fetch(`${API_BASE}/api/reports/billing`, { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCommercials)
      .catch(() => setCommercialsError(true));
  }, [supervisor]);

  useEffect(() => {
    setError('');
    fetch(`${API_BASE}/api/stats${selected ? `?commercial_id=${selected}` : ''}`, { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error('No se pudieron cargar las estadísticas'); return r.json(); })
      .then(setStats)
      .catch(e => setError(e.message));
  }, [selected]);

  if (error) return <p role="alert" className="text-red-600 text-sm">{error}</p>;
  if (!stats) return <Empty>Cargando estadísticas…</Empty>;

  return (
    <div className="flex flex-col gap-6">
      {supervisor && (
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Comercial
          <select value={selected} onChange={e => setSelected(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {commercials.map(c => <option key={c.commercial_id} value={c.commercial_id}>{c.commercial_name}</option>)}
          </select>
        </label>
      )}
      {commercialsError && (
        <p role="alert" className="text-sm text-red-600">No se pudo cargar la lista de comerciales; el filtro no está disponible.</p>
      )}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard label="Facturado" value={eur(stats.totals.billed)} tone="brand" />
        <StatCard label="Beneficio neto" value={eur(stats.totals.profit)} tone="good" />
        <StatCard label="Pedidos" value={String(stats.totals.orders)} />
      </div>
      <p className="text-xs text-slate-500">Los meses y días de los gráficos se calculan en hora UTC.</p>
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <Card><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Facturación por mes</h2>
          <BarChart name="facturacion" unit=" €" data={stats.monthly.map(m => ({ label: m.month, value: m.billed }))} /></Card>
        <Card><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Beneficio neto por mes</h2>
          <BarChart name="beneficio" unit=" €" data={stats.monthly.map(m => ({ label: m.month, value: m.profit }))} /></Card>
      </div>
      <Card><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Ventas por día</h2>
        <BarChart name="ventas" data={stats.daily.map(d => ({ label: d.day.slice(5), value: d.sales }))} /></Card>
    </div>
  );
}
