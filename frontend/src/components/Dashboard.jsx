import React from 'react';
import AppShell from './AppShell.jsx';
import StatsDashboard from './StatsDashboard.jsx';
import SupervisionPanel from './SupervisionPanel.jsx';
import { Card } from './ui.jsx';

export default function Dashboard() {
  const supervisor = localStorage.getItem('role') !== 'comercial';
  return (
    <AppShell active="dashboard" title="Dashboard">
      <div className="flex flex-col gap-6">
        <StatsDashboard supervisor={supervisor} />
        {supervisor && <Card title="Supervisión"><SupervisionPanel /></Card>}
      </div>
    </AppShell>
  );
}
