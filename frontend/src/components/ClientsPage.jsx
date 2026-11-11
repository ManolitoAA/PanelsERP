import React, { useState } from 'react';
import AppShell from './AppShell.jsx';
import ClientList from './ClientList.jsx';
import ClientForm from './ClientForm.jsx';
import { Card, Button } from './ui.jsx';

const FILTERS = [['', 'Todos'], ['lead', 'Leads'], ['cliente', 'Clientes']];

export default function ClientsPage() {
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState('');
  const readOnly = localStorage.getItem('role') === 'admin_rrhh';
  return (
    <AppShell active="clients" title="Clientes y leads">
      <div className="flex flex-col gap-6">
        {!readOnly && <Card title="Nuevo registro"><ClientForm onCreated={() => setVersion(v => v + 1)} /></Card>}
        <Card>
          <div className="flex gap-2 mb-4">
            {FILTERS.map(([value, label]) => (
              <Button key={label} variant={status === value ? 'primary' : 'secondary'} onClick={() => setStatus(value)}>{label}</Button>
            ))}
          </div>
          <ClientList key={version} status={status} />
        </Card>
      </div>
    </AppShell>
  );
}
