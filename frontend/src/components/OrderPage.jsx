import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import OrderForm from './OrderForm.jsx';
import { API_BASE, authHeaders } from './api.js';

export default function OrderPage() {
  const clientId = Number(new URLSearchParams(window.location.search).get('client_id'));
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    fetch(`${API_BASE}/api/clients/${clientId}`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(setClient)
      .catch(() => {});
  }, [clientId]);

  return (
    <AppShell active="orders" title="Nuevo pedido"
      subtitle={client ? `Para ${client.company} · ${client.name}` : 'Añade las líneas: el beneficio se calcula mientras escribes.'}>
      <OrderForm clientId={clientId} onSuccess={() => { window.location.href = '/orders'; }} />
    </AppShell>
  );
}
