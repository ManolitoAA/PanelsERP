import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Button, Field, Empty, ErrorNote, Person, inputClass, rowClass, cellClass } from './ui.jsx';
import Icon from './icons.jsx';

const COLUMNS = [{ label: 'Proveedor' }, { label: 'Contacto' }, { label: 'Notas' }];

export default function SuppliersPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', contact_info: '', notes: '' });
  const [error, setError] = useState('');
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const load = () => fetch(`${API_BASE}/api/suppliers`, { headers: authHeaders() }).then(r => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API_BASE}/api/suppliers`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) });
    if (!res.ok) return setError('No se pudo crear el proveedor');
    setForm({ name: '', contact_info: '', notes: '' });
    load();
  }

  return (
    <AppShell active="suppliers" title="Proveedores" subtitle="Quién te sirve el material y cómo localizarle, a mano para el próximo pedido.">
      <div className="flex flex-col gap-6">
        <Card title="Nuevo proveedor">
          <form onSubmit={submit} className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
            <Field label="Nombre"><input name="supplier-name" placeholder="Nombre" required value={form.name} onChange={set('name')} className={inputClass} /></Field>
            <Field label="Contacto"><input name="supplier-contact" placeholder="Email o teléfono" required value={form.contact_info} onChange={set('contact_info')} className={inputClass} /></Field>
            <Field label="Notas"><input name="supplier-notes" placeholder="Material, plazos…" value={form.notes} onChange={set('notes')} className={inputClass} /></Field>
            <Button type="submit"><Icon name="plus" className="h-4 w-4" />Añadir proveedor</Button>
            {error && <div className="md:col-span-4"><ErrorNote>{error}</ErrorNote></div>}
          </form>
        </Card>
        <Card title="Directorio" style={{ '--i': 1 }}>
          {rows.length ? (
            <Table columns={COLUMNS}>
              {rows.map(s => (
                <tr key={s.id} className={rowClass}>
                  <td className={cellClass}><Person name={s.name} /></td>
                  <td className={`${cellClass} text-slate-600`}>{s.contact_info}</td>
                  <td className={`${cellClass} text-slate-600`}>{s.notes}</td>
                </tr>
              ))}
            </Table>
          ) : <Empty icon="truck">Sin proveedores todavía.</Empty>}
        </Card>
      </div>
    </AppShell>
  );
}
