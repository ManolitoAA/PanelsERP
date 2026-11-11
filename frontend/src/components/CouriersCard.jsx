import React, { useEffect, useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Button, Field, Empty, ErrorNote, Person, inputClass, rowClass, cellClass } from './ui.jsx';
import Icon from './icons.jsx';

const EMPTY = { name: '', support_phone: '', tracking_url: '' };
const COLUMNS = [{ label: 'Mensajería' }, { label: 'Atención al cliente' }, { label: 'Web de seguimiento' }, { label: '' }];

async function errorText(res, fallback) {
  const detail = (await res.json().catch(() => ({}))).detail;
  return typeof detail === 'string' ? detail : fallback;
}

// Alta o edición de una mensajería. Devuelve la guardada por onSaved.
export function CourierForm({ courier, onSaved, onCancel, compact = false }) {
  const [form, setForm] = useState(courier ? { ...EMPTY, ...courier } : EMPTY);
  const [error, setError] = useState('');
  const set = k => e => setForm({ ...form, [k]: e.target.value });
  useEffect(() => { setForm(courier ? { ...EMPTY, ...courier } : EMPTY); }, [courier]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const { name, support_phone, tracking_url } = form;
    const res = await fetch(`${API_BASE}/api/couriers${courier ? `/${courier.id}` : ''}`, {
      method: courier ? 'PUT' : 'POST', headers: authHeaders(),
      body: JSON.stringify({ name, support_phone, tracking_url }),
    });
    if (!res.ok) return setError(await errorText(res, 'No se pudo guardar la mensajería'));
    const saved = await res.json();
    if (!courier) setForm(EMPTY);
    onSaved(saved);
  }

  return (
    <form onSubmit={submit} aria-label={courier ? 'Editar mensajería' : 'Nueva mensajería'}
      className={`grid gap-3 grid-cols-1 items-end ${compact ? '' : 'md:grid-cols-[1fr_1fr_1.5fr_auto]'}`}>
      <Field label="Nombre"><input name="courier-name" placeholder="SEUR, MRW, DHL…" required value={form.name} onChange={set('name')} className={inputClass} /></Field>
      <Field label="Teléfono atención al cliente"><input name="courier-phone" type="tel" placeholder="Para reclamar" value={form.support_phone || ''} onChange={set('support_phone')} className={inputClass} /></Field>
      <Field label="Web de seguimiento (usa {tracking})"><input name="courier-url" type="url" placeholder="https://…?id={tracking}" value={form.tracking_url || ''} onChange={set('tracking_url')} className={inputClass} /></Field>
      <div className="flex gap-2">
        <Button type="submit"><Icon name={courier ? 'check' : 'plus'} className="h-4 w-4" />{courier ? 'Guardar' : 'Añadir mensajería'}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>}
      </div>
      {error && <div className={compact ? '' : 'md:col-span-4'}><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}

export default function CouriersCard({ readOnly = false, style }) {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetch(`${API_BASE}/api/couriers`, { headers: authHeaders() })
    .then(r => { if (!r.ok) throw new Error('No se pudieron cargar las mensajerías'); return r.json(); })
    .then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <Card title="Mensajerías" style={style}>
      <div className="flex flex-col gap-5">
        {!readOnly && (
          <CourierForm courier={editing} onCancel={editing ? () => setEditing(null) : undefined}
            onSaved={() => { setEditing(null); load(); }} />
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        {rows && rows.length > 0 && (
          <Table columns={COLUMNS}>
            {rows.map(c => (
              <tr key={c.id} className={rowClass}>
                <td className={cellClass}><Person name={c.name} /></td>
                <td className={`${cellClass} font-mono text-slate-600`}>
                  {c.support_phone ? <a href={`tel:${c.support_phone.replace(/\s/g, '')}`} className="hover:text-accent-700">{c.support_phone}</a> : '—'}
                </td>
                <td className={`${cellClass} text-slate-600 break-all`}>{c.tracking_url || '—'}</td>
                <td className={`${cellClass} text-right`}>
                  {!readOnly && <Button variant="secondary" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}>Editar</Button>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {rows && !rows.length && <Empty icon="truck">Sin mensajerías todavía.</Empty>}
      </div>
    </Card>
  );
}
