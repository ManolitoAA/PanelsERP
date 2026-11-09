import React from 'react';

export function Card({ title, children, className = '', testId }) {
  return (
    <section data-testid={testId} className={`bg-white rounded-2xl shadow-card border border-slate-100 p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h3>}
      {children}
    </section>
  );
}

const TONES = { default: 'text-slate-900', good: 'text-emerald-600', brand: 'text-brand-600' };

export function StatCard({ label, value, tone = 'default' }) {
  const id = `stat-${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`;
  return (
    <Card testId={id}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${TONES[tone]}`}>{value}</p>
    </Card>
  );
}

export function Table({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
            {columns.map(c => (
              <th key={c.key || c.label} className={`px-4 py-3 font-semibold ${c.right ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

const VARIANTS = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export const inputClass =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

export function Empty({ children = 'Sin datos' }) {
  return <p className="text-sm text-slate-400 py-6 text-center">{children}</p>;
}

const CHART_HEIGHT = 180;
const fmt = (v, unit) => `${v.toLocaleString('es-ES')}${unit}`;

// Columnas con eje en el 0: positivas hacia arriba, negativas hacia abajo (rojo),
// valor 0 = marca fina sobre el eje, sin datos = <Empty />.
export function BarChart({ name, data, unit = '' }) {
  if (!data.length) return <Empty />;
  const maxPos = Math.max(0, ...data.map(d => d.value));
  const maxNeg = Math.max(0, ...data.map(d => -d.value));
  const total = maxPos + maxNeg || 1;
  const topH = (CHART_HEIGHT * maxPos) / total;
  const bottomH = (CHART_HEIGHT * maxNeg) / total;

  return (
    <div className="overflow-x-auto">
      <ul className="flex gap-2 min-w-full">
        {data.map(d => {
          const kind = d.value > 0 ? 'positive' : d.value < 0 ? 'negative' : 'zero';
          return (
            <li key={d.label} className="flex flex-col items-stretch min-w-[56px] flex-1" title={`${d.label}: ${fmt(d.value, unit)}`}>
              <div className="flex flex-col justify-end" style={{ height: topH }}>
                {kind === 'positive' && (
                  <div data-testid={`bar-${name}-${d.label}`} data-kind={kind} className="bg-brand-500 rounded-t"
                    style={{ height: (d.value / maxPos) * topH }} />
                )}
              </div>
              <div data-testid={`zero-line-${name}`} className="h-px bg-slate-400" />
              <div style={{ height: bottomH }}>
                {kind === 'zero' && (
                  <div data-testid={`bar-${name}-${d.label}`} data-kind={kind} className="bg-slate-500" style={{ height: 3 }} />
                )}
                {kind === 'negative' && (
                  <div data-testid={`bar-${name}-${d.label}`} data-kind={kind} className="bg-red-500 rounded-b"
                    style={{ height: (-d.value / maxNeg) * bottomH }} />
                )}
              </div>
              <span className={`mt-1 text-center text-xs tabular-nums ${d.value < 0 ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>{fmt(d.value, unit)}</span>
              <span className="text-center text-xs text-slate-400">{d.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
