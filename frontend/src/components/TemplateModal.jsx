import React, { useState } from 'react';

import { API_BASE, authHeaders } from './api.js';
import { Button, Field, ErrorNote, inputClass } from './ui.jsx';
import Icon from './icons.jsx';

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
    <div className="fixed inset-0 bg-night/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="tpl-modal-title">
      <div className="enter bg-white rounded-2xl shadow-lift w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col gap-4 p-6">
        <div className="flex justify-between items-center gap-3">
          <h2 id="tpl-modal-title" className="text-lg font-semibold tracking-display text-night">{template.name}</h2>
          <button onClick={onClose} aria-label="Cerrar"
            className="press grid place-items-center h-11 w-11 rounded-lg text-slate-600 hover:text-night hover:bg-mist">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="Variables (JSON)">
          <textarea rows={4} value={context} onChange={e => setContext(e.target.value)} className={`${inputClass} py-2 font-mono`} />
        </Field>

        <Button variant="secondary" onClick={handleRender}><Icon name="eye" className="h-4 w-4" />Previsualizar</Button>

        {preview && (
          <div className="rounded-xl border border-accent-100 bg-accent-50/60 p-4 text-sm flex flex-col gap-2">
            <p className="font-medium text-night">Asunto: {preview.rendered_subject}</p>
            <pre className="whitespace-pre-wrap font-sans text-slate-700">{preview.rendered_body}</pre>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-night/5">
          <Button variant="secondary" onClick={handleCopy} className="flex-1">
            <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />{copied ? '¡Copiado!' : 'Copiar al portapapeles'}
          </Button>
          <div className="flex flex-1 gap-2">
            <input type="email" aria-label="Email de destino" placeholder="email@destino.de" value={toEmail}
              onChange={e => setToEmail(e.target.value)} className={`${inputClass} flex-1`} />
            <Button onClick={handleSend} disabled={sending || !toEmail}>
              <Icon name="send" className="h-4 w-4" />{sending ? '…' : 'Enviar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
