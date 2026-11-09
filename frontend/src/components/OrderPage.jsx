import React, { useEffect } from 'react';
import OrderForm from './OrderForm.jsx';

export default function OrderPage() {
  const clientId = Number(new URLSearchParams(window.location.search).get('client_id'));
  useEffect(() => {
    if (!localStorage.getItem('token')) window.location.href = '/';
  }, []);
  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <a href="/dashboard" className="text-sm text-blue-600 hover:underline">← Volver</a>
        <h1 className="text-lg font-bold text-blue-700">Nuevo Pedido</h1>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <OrderForm clientId={clientId} onSuccess={() => { window.location.href = '/dashboard'; }} />
      </main>
    </>
  );
}
