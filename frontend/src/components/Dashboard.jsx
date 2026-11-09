import React, { useState } from 'react';
import AppShell from './AppShell.jsx';
import ClientList from './ClientList.jsx';
import ClientForm from './ClientForm.jsx';
import SupervisionPanel from './SupervisionPanel.jsx';
import { Card } from './ui.jsx';

export default function Dashboard() {
  const [version, setVersion] = useState(0);
  const role = localStorage.getItem('role');
  const supervisor = role !== 'comercial';

  return (
    <AppShell active="dashboard" title="Dashboard">
      <div className="flex flex-col gap-6">
        {supervisor && (
          <Card title="Supervisión"><SupervisionPanel /></Card>
        )}
        <Card title={supervisor ? 'Todos los clientes' : 'Mis Clientes'}>
          {role === 'comercial' && <ClientForm onCreated={() => setVersion(v => v + 1)} />}
          <ClientList key={version} />
        </Card>
      </div>
    </AppShell>
  );
}
