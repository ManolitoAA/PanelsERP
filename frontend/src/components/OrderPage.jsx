import React from 'react';
import AppShell from './AppShell.jsx';
import OrderForm from './OrderForm.jsx';
import { Card } from './ui.jsx';

export default function OrderPage() {
  const clientId = Number(new URLSearchParams(window.location.search).get('client_id'));
  return (
    <AppShell active="orders" title="Nuevo pedido">
      <Card>
        <OrderForm clientId={clientId} onSuccess={() => { window.location.href = '/orders'; }} />
      </Card>
    </AppShell>
  );
}
