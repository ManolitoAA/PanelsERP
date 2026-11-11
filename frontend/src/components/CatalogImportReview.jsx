import React, { useState } from 'react';
import { API_BASE, authHeaders } from './api.js';
import { Badge, Button, ErrorNote, Table, cellClass, inputClass, rowClass } from './ui.jsx';
import { pendingDecisions } from './catalog.js';

const COLUMNS = [{ label: 'Modelo' }, { label: 'Medidas' }, { label: 'Referencia' }, { label: 'Precio €' },
  { label: 'Coste €' }, { label: 'Estado' }, { label: 'Acción' }];
const ACTION_LABELS = { crear: 'Crear otro', sobrescribir: 'Sobrescribir', mantener: 'Mantener el antiguo', descartar: 'Descartar' };
const STATUS_TONE = { nueva: 'cliente', conflicto: 'lead', repetida: 'default' };

const describe = v => [v.dimensions.join(' × '), v.reference && `ref ${v.reference}`,
  v.unit_price != null && `${v.unit_price} €`, v.unit_cost != null && `coste ${v.unit_cost} €`].filter(Boolean).join(' · ');

export default function CatalogImportReview({ preview: initial, onDone, onCancel }) {
  const [preview, setPreview] = useState(initial);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  function update(pi, vi, field, value) {
    setPreview(prev => ({
      ...prev,
      products: prev.products.map((p, i) => i !== pi ? p : {
        ...p, variants: p.variants.map((v, j) => j !== vi ? v : { ...v, [field]: value }),
      }),
    }));
  }

  const money = value => value === '' ? null : Number(value);
  const pending = pendingDecisions(preview);

  async function confirm() {
    setError(''); setNotice(''); setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/import/confirm`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(preview) });
      const data = await res.json();
      if (res.ok) return onDone(data);
      if (res.status === 409) {
        setPreview(data.detail);
        return setNotice('Han cambiado productos mientras revisabas. Revisa los conflictos nuevos y confirma otra vez.');
      }
      setError(typeof data.detail === 'string' ? data.detail : 'No se pudo guardar la importación');
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="import-review">
      {preview.failed_pages.length > 0 && <ErrorNote>No se pudieron leer las páginas {preview.failed_pages.join(', ')}.</ErrorNote>}
      {notice && <p role="status" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Table columns={COLUMNS}>
        {preview.products.flatMap((p, pi) => p.variants.map((v, vi) => {
          const label = `${p.name} ${v.dimensions.join(' × ')}`;
          const editable = v.action !== 'descartar' && v.action !== 'mantener';
          return (
            <tr key={`${pi}-${vi}`} className={rowClass} data-testid="review-row">
              <td className={`${cellClass} font-medium text-night`}>{p.name}</td>
              <td className={`${cellClass} font-mono text-slate-600`}>
                {v.dimensions.join(' × ')}
                {v.existing && <span className="block text-xs text-slate-500">Actual: {describe(v.existing)}</span>}
              </td>
              <td className={cellClass}>
                <input aria-label={`Referencia de ${label}`} value={v.reference ?? ''} disabled={!editable}
                  onChange={e => update(pi, vi, 'reference', e.target.value || null)} className={`${inputClass} w-28`} />
              </td>
              <td className={cellClass}>
                <input type="number" min="0" step="0.01" aria-label={`Precio de ${label}`} value={v.unit_price ?? ''} disabled={!editable}
                  onChange={e => update(pi, vi, 'unit_price', money(e.target.value))} className={`${inputClass} w-24 font-mono`} />
              </td>
              <td className={cellClass}>
                <input type="number" min="0" step="0.01" aria-label={`Coste de ${label}`} value={v.unit_cost ?? ''} disabled={!editable}
                  onChange={e => update(pi, vi, 'unit_cost', money(e.target.value))} className={`${inputClass} w-24 font-mono`} />
              </td>
              <td className={cellClass}><Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge></td>
              <td className={cellClass}>
                {v.status === 'nueva' ? (
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={v.action === 'descartar'}
                      onChange={e => update(pi, vi, 'action', e.target.checked ? 'descartar' : null)} />
                    Descartar
                  </label>
                ) : (
                  <select aria-label={`Acción para ${label}`} value={v.action ?? ''} required
                    onChange={e => update(pi, vi, 'action', e.target.value || null)} className={inputClass}>
                    <option value="">Elige…</option>
                    {v.allowed_actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                  </select>
                )}
              </td>
            </tr>
          );
        }))}
      </Table>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={confirm} disabled={saving || pending > 0}>{saving ? 'Guardando…' : 'Confirmar importación'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        {pending > 0 && <span className="text-sm text-slate-600">Faltan {pending} decisiones por tomar.</span>}
      </div>
    </div>
  );
}
