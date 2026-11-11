import React, { useState } from 'react';
import AppShell from './AppShell.jsx';
import ClientList from './ClientList.jsx';
import ClientForm from './ClientForm.jsx';
import { Card } from './ui.jsx';

const FILTERS = [['', 'Todos'], ['lead', 'Leads'], ['cliente', 'Clientes']];

export default function ClientsPage() {
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState('');
  const readOnly = localStorage.getItem('role') === 'admin_rrhh';
  const filters = (
    <div role="group" aria-label="Filtrar por estado" className="inline-flex rounded-xl bg-mist p-1">
      {FILTERS.map(([value, label]) => (
        <button key={label} type="button" onClick={() => setStatus(value)} aria-pressed={status === value}
          className={`press rounded-lg px-3.5 min-h-[36px] text-sm font-medium ${
            status === value ? 'bg-white text-night shadow-card' : 'text-slate-600 hover:text-night'}`}>
          {label}
        </button>
      ))}
    </div>
  );
  return (
    <AppShell active="clients" title="Clientes y leads"
      subtitle="Cada lead que conviertes suma su facturación y su beneficio aquí mismo.">
      <div className="flex flex-col gap-6">
        {!readOnly && <Card title="Nuevo registro"><ClientForm onCreated={() => setVersion(v => v + 1)} /></Card>}
        <Card title="Cartera" action={filters} style={{ '--i': 1 }}>
          <ClientList key={version} status={status} />
        </Card>
      </div>
    </AppShell>
  );
}
