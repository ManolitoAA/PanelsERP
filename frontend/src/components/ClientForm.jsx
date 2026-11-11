import React, { useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Button, Field, ErrorNote, inputClass } from './ui.jsx';
import Icon from './icons.jsx';

export default function ClientForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', company: '', contact_email: '' });
  const [error, setError] = useState('');
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API_BASE}/api/clients`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(form),
    });
    if (!res.ok) return setError('No se pudo crear el cliente');
    setForm({ name: '', company: '', contact_email: '' });
    onCreated();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
      <Field label="Nombre"><input name="client-name" placeholder="Nombre" required value={form.name} onChange={set('name')} className={inputClass} /></Field>
      <Field label="Empresa"><input name="client-company" placeholder="Empresa" required value={form.company} onChange={set('company')} className={inputClass} /></Field>
      <Field label="Email"><input name="client-email" type="email" placeholder="Email" required value={form.contact_email} onChange={set('contact_email')} className={inputClass} /></Field>
      <Button type="submit"><Icon name="plus" className="h-4 w-4" />Crear cliente</Button>
      {error && <div className="md:col-span-4"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}
