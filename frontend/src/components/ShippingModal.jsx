import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Button, Field, ErrorNote, inputClass } from './ui.jsx';
import Icon from './icons.jsx';
import { CourierForm } from './CouriersCard.jsx';
import { SHIPPING_STATUSES } from './shipping.js';

export default function ShippingModal({ order, clientName, onClose, onSaved }) {
  const [couriers, setCouriers] = useState([]);
  const [courierId, setCourierId] = useState(order.courier_id ? String(order.courier_id) : '');
  const [tracking, setTracking] = useState(order.tracking_code || '');
  const [status, setStatus] = useState(order.status);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const legacy = !SHIPPING_STATUSES.includes(order.status);

  useEffect(() => {
    fetch(`${API_BASE}/api/couriers`, { headers: authHeaders() }).then(r => r.json()).then(setCouriers).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const body = { courier_id: courierId ? Number(courierId) : null, tracking_code: tracking };
    // si sigue «en curso» y hay mensajería + tracking, el backend lo pasa a «enviado»
    if (!legacy && status !== order.status) body.status = status;
    const res = await fetch(`${API_BASE}/api/orders/${order.id}/shipping`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))).detail;
      return setError(typeof detail === 'string' ? detail : 'No se pudo guardar el envío');
    }
    onSaved(await res.json());
  }

  return (
    <div className="fixed inset-0 bg-night/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="ship-modal-title">
      <div className="enter bg-white rounded-2xl shadow-lift w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col gap-4 p-6">
        <div className="flex justify-between items-center gap-3">
          <h2 id="ship-modal-title" className="text-lg font-semibold tracking-display text-night">Envío del pedido #{order.id} · {clientName}</h2>
          <button onClick={onClose} aria-label="Cerrar"
            className="press grid place-items-center h-11 w-11 rounded-lg text-slate-600 hover:text-night hover:bg-mist">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {adding ? (
          <div className="rounded-xl border border-night/10 bg-paper/70 p-4">
            <CourierForm compact onCancel={() => setAdding(false)} onSaved={c => {
              setCouriers(list => [...list, c].sort((a, b) => a.name.localeCompare(b.name)));
              setCourierId(String(c.id));
              setAdding(false);
            }} />
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <ErrorNote>{error}</ErrorNote>}
            <Field label="Mensajería">
              <div className="flex gap-2">
                <select name="courier" value={courierId} onChange={e => setCourierId(e.target.value)} className={inputClass}>
                  <option value="">Sin mensajería</option>
                  {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button type="button" variant="secondary" onClick={() => setAdding(true)} aria-label="Nueva mensajería">
                  <Icon name="plus" className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <Field label="Código de seguimiento">
              <input name="tracking" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking de la mensajería" className={`${inputClass} font-mono`} />
            </Field>
            {legacy ? (
              <p className="text-xs text-slate-600">Pedido anterior a los envíos: su estado no cambia.</p>
            ) : (
              <Field label="Estado">
                <select name="order-status" value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                  {SHIPPING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit"><Icon name="check" className="h-4 w-4" />Guardar envío</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
