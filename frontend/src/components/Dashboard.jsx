import React from 'react';
import AppShell from './AppShell.jsx';
import StatsDashboard from './StatsDashboard.jsx';
import SupervisionPanel from './SupervisionPanel.jsx';
import Icon from './icons.jsx';
import { Card } from './ui.jsx';

const SHORTCUTS = [
  { href: '/clients', icon: 'users', label: 'Alta de cliente', text: 'Registra un lead y conviértelo en cliente', write: true },
  { href: '/orders', icon: 'receipt', label: 'Ver pedidos', text: 'Facturado y beneficio de cada pedido' },
  { href: '/templates', icon: 'mail', label: 'Enviar presupuesto', text: 'Plantillas listas para correo o WhatsApp' },
];

export default function Dashboard() {
  const role = localStorage.getItem('role');
  const supervisor = role !== 'comercial';
  const shortcuts = SHORTCUTS.filter(s => !s.write || role !== 'admin_rrhh');
  return (
    <AppShell active="dashboard" title="Dashboard"
      subtitle={supervisor ? 'Facturación y beneficio de todo el equipo comercial.' : 'Tu facturación y tu beneficio neto, pedido a pedido.'}>
      <div className="flex flex-col gap-6">
        <StatsDashboard supervisor={supervisor} />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {shortcuts.map((s, i) => (
            <a key={s.href} href={s.href} style={{ '--i': i + 4 }}
              className="enter lift group flex items-center gap-4 rounded-2xl bg-white border border-night/5 shadow-card p-5 hover:shadow-lift hover:border-accent-500/40">
              <span className="grid place-items-center h-11 w-11 rounded-xl bg-accent-50 text-accent-700 transition-colors group-hover:bg-accent-500 group-hover:text-night">
                <Icon name={s.icon} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-night">{s.label}</span>
                <span className="block text-xs text-slate-600">{s.text}</span>
              </span>
              <Icon name="arrow" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-night" />
            </a>
          ))}
        </div>
        {supervisor && <Card title="Supervisión"><SupervisionPanel /></Card>}
      </div>
    </AppShell>
  );
}
