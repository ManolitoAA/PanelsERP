import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import TemplateModal from './TemplateModal.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Button, Empty, inputClass } from './ui.jsx';

const COLUMNS = [{ label: 'Plantilla' }, { label: 'Asunto' }, { label: '' }];

export default function TemplatesPage() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', body_content: '' });
  const [error, setError] = useState('');
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const load = () => fetch(`${API_BASE}/api/templates`, { headers: authHeaders() }).then(r => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API_BASE}/api/templates`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) });
    if (!res.ok) return setError('No se pudo crear la plantilla');
    setForm({ name: '', subject: '', body_content: '' });
    load();
  }

  return (
    <AppShell active="templates" title="Plantillas de mensajes">
      <div className="flex flex-col gap-6">
        <Card title="Nueva plantilla">
          <p className="text-xs text-slate-500 mb-3">Usa variables con {'{{ nombre }}'}, {'{{ importe }}'}…</p>
          <form onSubmit={submit} className="flex flex-col gap-2 max-w-xl">
            <input name="tpl-name" placeholder="Nombre" required value={form.name} onChange={set('name')} className={inputClass} />
            <input name="tpl-subject" placeholder="Asunto" required value={form.subject} onChange={set('subject')} className={inputClass} />
            <textarea name="tpl-body" placeholder="Cuerpo del mensaje" required rows={4} value={form.body_content} onChange={set('body_content')} className={inputClass} />
            <Button type="submit" className="self-start">Crear plantilla</Button>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </form>
        </Card>
        <Card>
          {rows.length ? (
            <Table columns={COLUMNS}>
              {rows.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{t.subject}</td>
                  <td className="px-4 py-3 text-right"><Button variant="secondary" onClick={() => setSelected(t)}>Usar</Button></td>
                </tr>
              ))}
            </Table>
          ) : <Empty>Sin plantillas todavía.</Empty>}
        </Card>
      </div>
      {selected && <TemplateModal template={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}
