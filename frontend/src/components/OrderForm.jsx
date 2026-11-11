import React, { useEffect, useState } from 'react';
import { Button, Field, ErrorNote, inputClass } from './ui.jsx';
import { marginPct } from './format.js';
import { pickVariant, variantOptions } from './catalog.js';
import Icon from './icons.jsx';

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

const EMPTY_ITEM = { product_name: '', quantity: 1, unit_price: '', unit_cost: '' };

export default function OrderForm({ clientId, onSuccess }) {
  const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : []).then(p => setOptions(variantOptions(p))).catch(() => {});
  }, []);

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: val };
      return field === 'product_name' ? pickVariant(next, options) : next;
    }));
  }

  function addItem() {
    setItems(prev => [...prev, { ...EMPTY_ITEM }]);
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
          unit_cost: Number(it.unit_cost),
          ...(it.variant_id ? { variant_id: it.variant_id } : {}),
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
  const loss = totals.profit < 0;

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
      <div className="flex flex-col gap-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {items.map((it, idx) => {
          const c = calcItem(it);
          return (
            <div key={idx} style={{ '--i': idx }}
              className="enter grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 p-4 md:p-5 bg-white rounded-2xl border border-night/5 shadow-card">
              <Field label={`Línea ${idx + 1} · Producto`} className="col-span-2 md:col-span-1">
                <input placeholder="Producto" required value={it.product_name} list="catalog-variants"
                  onChange={e => updateItem(idx, 'product_name', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Cantidad">
                <input type="number" placeholder="Cant." min="1" value={it.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)} className={`${inputClass} font-mono`} />
              </Field>
              <Field label="Precio unidad">
                <input type="number" placeholder="Precio €" step="0.01" min="0" value={it.unit_price}
                  onChange={e => updateItem(idx, 'unit_price', e.target.value)} className={`${inputClass} font-mono`} />
              </Field>
              <Field label="Coste unidad">
                <input type="number" placeholder="Coste €" step="0.01" min="0" required value={it.unit_cost}
                  onChange={e => updateItem(idx, 'unit_cost', e.target.value)} className={`${inputClass} font-mono`} />
              </Field>
              <Field label="Margen">
                <input name="margin" readOnly tabIndex={-1} aria-label="Margen %" value={`${c.margin} %`}
                  className={`${inputClass} font-mono bg-accent-50 border-accent-100 text-accent-800`} />
              </Field>
              <p className="col-span-2 md:col-span-5 flex gap-4 text-xs text-slate-600 border-t border-night/5 pt-3">
                <span>Subtotal <strong className="font-mono font-medium text-night">{c.subtotal} €</strong></span>
                <span>Beneficio <strong className={`font-mono font-medium ${Number(c.profit) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{c.profit} €</strong></span>
              </p>
            </div>
          );
        })}
        <datalist id="catalog-variants">
          {options.map(o => <option key={o.variant.id} value={o.label} />)}
        </datalist>
        <button type="button" onClick={addItem}
          className="press self-start inline-flex items-center gap-2 rounded-xl border border-dashed border-night/20 px-4 min-h-[44px] text-sm font-medium text-slate-600 hover:border-accent-500 hover:text-accent-700 hover:bg-white">
          <Icon name="plus" className="h-4 w-4" />Añadir línea
        </button>
      </div>

      <aside className="enter lg:sticky lg:top-8 rounded-2xl bg-night text-mist p-6 shadow-glow grid-glow" style={{ '--i': 2 }}>
        <h2 className="text-sm text-night-400">Resumen del pedido</h2>
        <dl className="mt-5 flex flex-col gap-4">
          <div className="flex justify-between items-baseline">
            <dt className="text-sm text-night-400">Total</dt>
            <dd data-testid="order-total" className="font-mono text-2xl text-white tabular-nums">{totals.subtotal.toFixed(2)} €</dd>
          </div>
          <div className="flex justify-between items-baseline">
            <dt className="text-sm text-night-400">Beneficio neto</dt>
            <dd data-testid="order-profit" className={`font-mono text-2xl tabular-nums ${loss ? 'text-red-400' : 'text-emerald-400'}`}>{totals.profit.toFixed(2)} €</dd>
          </div>
          <div className="flex justify-between items-baseline border-t border-white/10 pt-4">
            <dt className="text-sm text-night-400">Margen</dt>
            <dd data-testid="order-margin" className="font-mono text-4xl text-accent-500 tabular-nums">{marginPct(totals.subtotal, totals.profit)}</dd>
          </div>
        </dl>
        {loss && <p className="mt-4 text-xs text-red-300">Este pedido vende por debajo del coste.</p>}
        <Button type="submit" disabled={submitting} className="mt-6 w-full min-h-[48px]">
          {submitting ? 'Guardando…' : 'Crear pedido'}
        </Button>
      </aside>
    </form>
  );
}
