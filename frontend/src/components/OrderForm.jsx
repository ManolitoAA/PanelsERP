import React, { useState } from 'react';

function calcItem(item) {
  const qty = Number(item.quantity) || 0;
  const cost = Number(item.unit_cost) || 0;
  const price = Number(item.unit_price) || 0;
  return {
    subtotal: (qty * price).toFixed(2),
    profit: (qty * (price - cost)).toFixed(2),
    margin: price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0',
  };
}

export default function OrderForm({ clientId, onSuccess }) {
  const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';
  const [items, setItems] = useState([
    { product_name: '', quantity: 1, unit_price: '', unit_cost: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function addItem() {
    setItems(prev => [...prev, { product_name: '', quantity: 1, unit_price: '', unit_cost: '' }]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        client_id: clientId,
        items: items.map(it => ({
          product_name: it.product_name,
          quantity: Number(it.quantity),
          ...(it.unit_price ? { unit_price: Number(it.unit_price) } : {}),
          ...(it.unit_cost ? { unit_cost: Number(it.unit_cost) } : {}),
        })),
      };
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Error al crear el pedido');
        return;
      }
      onSuccess && onSuccess(await res.json());
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  const totals = items.reduce((acc, it) => {
    const c = calcItem(it);
    return { subtotal: acc.subtotal + Number(c.subtotal), profit: acc.profit + Number(c.profit) };
  }, { subtotal: 0, profit: 0 });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {items.map((it, idx) => (
        <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
          <input placeholder="Producto" required value={it.product_name}
            onChange={e => updateItem(idx, 'product_name', e.target.value)}
            className="col-span-2 md:col-span-2 border rounded px-2 py-1" />
          <input type="number" placeholder="Cant." min="1" value={it.quantity}
            onChange={e => updateItem(idx, 'quantity', e.target.value)}
            className="border rounded px-2 py-1" />
          <input type="number" placeholder="Precio €" step="0.01" value={it.unit_price}
            onChange={e => updateItem(idx, 'unit_price', e.target.value)}
            className="border rounded px-2 py-1" />
          <input type="number" placeholder="Coste €" step="0.01" value={it.unit_cost}
            onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
            className="border rounded px-2 py-1" />
          <input name="margin" readOnly tabIndex={-1} aria-label="Margen %" value={`${calcItem(it).margin} %`}
            className="border rounded px-2 py-1 bg-slate-100 text-slate-600" />
          <p className="col-span-2 md:col-span-5 text-xs text-slate-500">
            Subtotal: <strong>{calcItem(it).subtotal} €</strong> · Beneficio: <strong className="text-emerald-700">{calcItem(it).profit} €</strong>
          </p>
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-sm text-brand-600 hover:underline self-start">+ Añadir línea</button>
      <div className="flex justify-between items-center border-t pt-3">
        <p className="text-sm text-slate-600">
          Total: <strong>{totals.subtotal.toFixed(2)} €</strong> · Beneficio: <strong className="text-emerald-700">{totals.profit.toFixed(2)} €</strong>
        </p>
        <button type="submit" disabled={submitting}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors">
          {submitting ? 'Guardando…' : 'Crear pedido'}
        </button>
      </div>
    </form>
  );
}
