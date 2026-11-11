import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import TemplateModal from './TemplateModal.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Button, Field, Empty, ErrorNote, inputClass, rowClass, cellClass } from './ui.jsx';
import Icon from './icons.jsx';

const COLUMNS = [{ label: 'Plantilla' }, { label: 'Asunto' }, { label: '' }];
const VARS = ['{{ nombre }}', '{{ empresa }}', '{{ importe }}'];

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
    <AppShell active="templates" title="Plantillas de mensajes"
      subtitle="Escribe el presupuesto una vez y envíalo por correo o cópialo a WhatsApp con los datos del cliente.">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
        <Card title="Nueva plantilla">
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-slate-600">
            Variables:
            {VARS.map(v => <code key={v} className="rounded-md bg-accent-50 text-accent-800 px-2 py-0.5 font-mono">{v}</code>)}
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="Nombre"><input name="tpl-name" placeholder="Presupuesto estándar" required value={form.name} onChange={set('name')} className={inputClass} /></Field>
            <Field label="Asunto"><input name="tpl-subject" placeholder="Presupuesto para {{ nombre }}" required value={form.subject} onChange={set('subject')} className={inputClass} /></Field>
            <Field label="Mensaje"><textarea name="tpl-body" placeholder="Hola {{ nombre }}…" required rows={5} value={form.body_content} onChange={set('body_content')} className={`${inputClass} py-2`} /></Field>
            <Button type="submit" className="self-start"><Icon name="plus" className="h-4 w-4" />Crear plantilla</Button>
            {error && <ErrorNote>{error}</ErrorNote>}
          </form>
        </Card>
        <Card title="Tus plantillas" style={{ '--i': 1 }}>
          {rows.length ? (
            <Table columns={COLUMNS}>
              {rows.map(t => (
                <tr key={t.id} className={rowClass}>
                  <td className={cellClass}>
                    <span className="flex items-center gap-3 font-medium text-night">
                      <span aria-hidden="true" className="grid place-items-center h-8 w-8 rounded-lg bg-accent-50 text-accent-700"><Icon name="mail" className="h-4 w-4" /></span>
                      {t.name}
                    </span>
                  </td>
                  <td className={`${cellClass} text-slate-600`}>{t.subject}</td>
                  <td className={`${cellClass} text-right`}><Button variant="secondary" onClick={() => setSelected(t)}>Usar</Button></td>
                </tr>
              ))}
            </Table>
          ) : <Empty icon="mail">Sin plantillas todavía.</Empty>}
        </Card>
      </div>
      {selected && <TemplateModal template={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}
