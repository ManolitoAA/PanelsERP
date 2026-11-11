import React from 'react';
import Icon from './icons.jsx';
import { initials } from './format.js';

export function Card({ title, children, className = '', testId, action, style }) {
  return (
    <section data-testid={testId} style={style}
      className={`enter bg-white rounded-2xl shadow-card border border-night/5 p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-5">
          {title && <h3 className="text-base font-semibold tracking-display text-night">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  default: { chip: 'bg-mist text-night', value: 'text-night' },
  good: { chip: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
  brand: { chip: 'bg-accent-50 text-accent-700', value: 'text-night' },
};

export function StatCard({ label, value, tone = 'default', icon = 'trend', hint, hero = false, index = 0 }) {
  const id = `stat-${label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}`;
  if (hero) {
    return (
      <section data-testid={id} style={{ '--i': index }}
        className="enter relative overflow-hidden rounded-2xl bg-night text-mist p-5 md:p-6 shadow-glow grid-glow">
        <div className="flex items-center gap-2 text-sm text-night-400">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-accent-500 text-night"><Icon name={icon} className="h-4 w-4" /></span>
          {label}
        </div>
        <p className="mt-5 font-mono text-3xl md:text-4xl tabular-nums tracking-tight text-white">{value}</p>
        {hint && <p className="mt-2 text-xs text-night-400">{hint}</p>}
      </section>
    );
  }
  const t = TONES[tone];
  return (
    <section data-testid={id} style={{ '--i': index }}
      className="enter rounded-2xl bg-white border border-night/5 shadow-card p-5 md:p-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className={`grid place-items-center h-8 w-8 rounded-lg ${t.chip}`}><Icon name={icon} className="h-4 w-4" /></span>
        {label}
      </div>
      <p className={`mt-5 font-mono text-3xl md:text-4xl tabular-nums tracking-tight ${t.value}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-slate-600">{hint}</p>}
    </section>
  );
}

export function Table({ columns, children }) {
  return (
    <div className="overflow-x-auto -mx-5 md:-mx-6">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-xs text-slate-600 border-y border-night/5 bg-paper/70">
            {columns.map(c => (
              <th key={c.key || c.label} className={`px-5 md:px-6 py-3 font-medium ${c.right ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-night/5">{children}</tbody>
      </table>
    </div>
  );
}

export const rowClass = 'transition-colors hover:bg-accent-50/50';
export const cellClass = 'px-5 md:px-6 py-3.5';
export const moneyClass = `${cellClass} text-right font-mono tabular-nums`;

const VARIANTS = {
  primary: 'bg-accent-500 hover:bg-accent-400 text-night shadow-[0_6px_20px_-8px_rgb(90_185_252/0.8)]',
  secondary: 'bg-white hover:bg-paper text-night border border-night/10',
  dark: 'bg-night hover:bg-night-700 text-white',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      {...props}
      className={`press inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-[40px] text-sm font-medium
        disabled:opacity-60 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
    />
  );
}

export const inputClass =
  'w-full border border-night/10 rounded-xl px-3 min-h-[40px] text-sm bg-white text-night placeholder:text-slate-400 transition-shadow ' +
  'focus:ring-4 focus:ring-accent-100 focus:border-accent-700';

export function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 text-xs font-medium text-slate-600 ${className}`}>
      {label}
      {children}
    </label>
  );
}

const BADGES = {
  lead: 'bg-amber-50 text-amber-800 ring-amber-200',
  cliente: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  enviado: 'bg-accent-50 text-accent-800 ring-accent-100',
  default: 'bg-mist text-night ring-night/10',
};

export function Badge({ tone = 'default', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${BADGES[tone] || BADGES.default}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function Avatar({ name, dark = false }) {
  return (
    <span aria-hidden="true"
      className={`grid place-items-center h-8 w-8 shrink-0 rounded-full text-xs font-semibold ${dark ? 'bg-accent-500 text-night' : 'bg-accent-50 text-accent-800'}`}>
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={name} />
      <span className="flex flex-col">
        <span className="font-medium text-night">{name}</span>
        {sub && <span className="text-xs text-slate-600">{sub}</span>}
      </span>
    </span>
  );
}

export function Empty({ children = 'Sin datos', icon = 'box' }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="grid place-items-center h-10 w-10 rounded-full bg-mist text-slate-400"><Icon name={icon} /></span>
      <p className="text-sm text-slate-600">{children}</p>
    </div>
  );
}

export function ErrorNote({ children }) {
  return <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{children}</p>;
}

export { BarChart } from './BarChart.jsx';
