import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Card, StatCard, BarChart, Empty, ErrorNote, inputClass } from './ui.jsx';
import { eur, marginPct } from './format.js';

function ChartCard({ title, children, index }) {
  return (
    <Card style={{ '--i': index }}>
      <h2 className="text-base font-semibold tracking-display text-night mb-6">{title}</h2>
      {children}
    </Card>
  );
}

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

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!stats) return <Empty>Cargando estadísticas…</Empty>;

  const { billed, profit, orders } = stats.totals;
  return (
    <div className="flex flex-col gap-6">
      {supervisor && (
        <label className="enter flex items-center gap-3 text-sm font-medium text-slate-600 self-start">
          Comercial
          <select value={selected} onChange={e => setSelected(e.target.value)} className={`${inputClass} w-auto min-w-[200px]`}>
            <option value="">Todos</option>
            {commercials.map(c => <option key={c.commercial_id} value={c.commercial_id}>{c.commercial_name}</option>)}
          </select>
        </label>
      )}
      {commercialsError && <ErrorNote>No se pudo cargar la lista de comerciales; el filtro no está disponible.</ErrorNote>}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard hero index={0} label="Facturado" icon="euro" value={eur(billed)} hint="Suma de todos los pedidos" />
        <StatCard index={1} label="Beneficio neto" icon="trend" tone="good" value={eur(profit)} hint="Venta menos coste, línea a línea" />
        <StatCard index={2} label="Margen" icon="percent" tone="brand" value={marginPct(billed, profit)} hint="Beneficio sobre facturado" />
        <StatCard index={3} label="Pedidos" icon="receipt" value={String(orders)} hint={orders ? `${eur(billed / orders)} de media` : 'Aún sin pedidos'} />
      </div>
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="Facturación por mes" index={4}>
          <BarChart name="facturacion" unit=" €" data={stats.monthly.map(m => ({ label: m.month, value: m.billed }))} />
        </ChartCard>
        <ChartCard title="Beneficio neto por mes" index={5}>
          <BarChart name="beneficio" unit=" €" data={stats.monthly.map(m => ({ label: m.month, value: m.profit }))} />
        </ChartCard>
      </div>
      <ChartCard title="Ventas por día" index={6}>
        <BarChart name="ventas" data={stats.daily.map(d => ({ label: d.day.slice(5), value: d.sales }))} />
      </ChartCard>
      <p className="text-xs text-slate-600 -mt-2">Los meses y días de los gráficos se calculan en hora UTC.</p>
    </div>
  );
}
