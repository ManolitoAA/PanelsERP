import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Button, Empty, inputClass } from './ui.jsx';

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
    <AppShell active="suppliers" title="Proveedores">
      <div className="flex flex-col gap-6">
        <Card title="Nuevo proveedor">
          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <input name="supplier-name" placeholder="Nombre" required value={form.name} onChange={set('name')} className={inputClass} />
            <input name="supplier-contact" placeholder="Contacto (email / teléfono)" required value={form.contact_info} onChange={set('contact_info')} className={inputClass} />
            <input name="supplier-notes" placeholder="Notas" value={form.notes} onChange={set('notes')} className={inputClass} />
            <Button type="submit">Añadir proveedor</Button>
            {error && <p role="alert" className="text-sm text-red-600 w-full">{error}</p>}
          </form>
        </Card>
        <Card>
          {rows.length ? (
            <Table columns={COLUMNS}>
              {rows.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.contact_info}</td>
                  <td className="px-4 py-3 text-slate-500">{s.notes}</td>
                </tr>
              ))}
            </Table>
          ) : <Empty>Sin proveedores todavía.</Empty>}
        </Card>
      </div>
    </AppShell>
  );
}
