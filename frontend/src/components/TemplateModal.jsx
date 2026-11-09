import React, { useState } from 'react';

import { API_BASE, authHeaders } from './api.js';

export default function TemplateModal({ template, onClose }) {
  const [context, setContext] = useState('{}');
  const [toEmail, setToEmail] = useState('');
  const [preview, setPreview] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleRender() {
    setError('');
    try {
      const ctx = JSON.parse(context);
      const res = await fetch(`${API_BASE}/api/templates/${template.id}/render`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ context: ctx }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error al renderizar');
      setPreview(await res.json());
    } catch (e) {
      setError(e.message || 'JSON de contexto inválido');
    }
  }

  async function handleCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(`${preview.rendered_subject}\n\n${preview.rendered_body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSend() {
    setError('');
    setSending(true);
    try {
      const ctx = JSON.parse(context);
      const res = await fetch(`${API_BASE}/api/templates/${template.id}/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ to_email: toEmail, context: ctx }),
      });
      if (!res.ok) throw new Error('Error al enviar email');
      onClose && onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col gap-4 p-6">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800">{template.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
          Variables (JSON)
          <textarea
            rows={4}
            value={context}
            onChange={e => setContext(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <button onClick={handleRender}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg py-2 transition-colors">
          Previsualizar
        </button>

        {preview && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm flex flex-col gap-1">
            <p className="font-semibold text-slate-700">Asunto: {preview.rendered_subject}</p>
            <pre className="whitespace-pre-wrap text-slate-600">{preview.rendered_body}</pre>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <button onClick={handleCopy}
            className="flex-1 border border-slate-300 hover:bg-slate-50 text-sm font-medium rounded-lg py-2 transition-colors">
            {copied ? '¡Copiado!' : 'Copiar al portapapeles'}
          </button>
          <div className="flex flex-1 gap-2">
            <input type="email" placeholder="email@destino.de" value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              className="flex-1 border rounded-lg px-2 py-2 text-sm" />
            <button onClick={handleSend} disabled={sending || !toEmail}
              className="bg-brand-600 text-white px-4 rounded-lg text-sm font-medium disabled:opacity-60">
              {sending ? '…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
