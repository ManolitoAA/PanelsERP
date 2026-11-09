import React from 'react';

export function Card({ title, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl shadow-card border border-slate-100 p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h3>}
      {children}
    </section>
  );
}

const TONES = { default: 'text-slate-900', good: 'text-emerald-600', brand: 'text-brand-600' };

export function StatCard({ label, value, tone = 'default' }) {
  return (
    <Card>
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

export function BarChart({ data, unit = '' }) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {data.map(d => (
        <li key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-slate-500 tabular-nums">{d.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right font-medium tabular-nums">{d.value.toLocaleString('es-ES')}{unit}</span>
        </li>
      ))}
    </ul>
  );
}
