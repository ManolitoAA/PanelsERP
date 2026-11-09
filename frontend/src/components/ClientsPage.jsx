import React, { useState } from 'react';
import AppShell from './AppShell.jsx';
import ClientList from './ClientList.jsx';
import ClientForm from './ClientForm.jsx';
import { Card } from './ui.jsx';

export default function ClientsPage() {
  const [version, setVersion] = useState(0);
  return (
    <AppShell active="clients" title="Clientes y leads">
      <Card>
        <ClientForm onCreated={() => setVersion(v => v + 1)} />
        <ClientList key={version} />
      </Card>
    </AppShell>
  );
}
