import React, { useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Button, inputClass } from './ui.jsx';

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

  const cls = inputClass;
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 mb-4">
      <input name="client-name" placeholder="Nombre" required value={form.name} onChange={set('name')} className={cls} />
      <input name="client-company" placeholder="Empresa" required value={form.company} onChange={set('company')} className={cls} />
      <input name="client-email" type="email" placeholder="Email" required value={form.contact_email} onChange={set('contact_email')} className={cls} />
      <Button type="submit">Crear cliente</Button>
      {error && <p role="alert" className="text-sm text-red-600 w-full">{error}</p>}
    </form>
  );
}
