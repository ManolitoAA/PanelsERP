import React, { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import CatalogImportReview from './CatalogImportReview.jsx';
import { API_BASE, authHeaders } from './api.js';
import { Card, Table, Empty, ErrorNote, cellClass, inputClass, rowClass } from './ui.jsx';
import { canEdit } from './catalog.js';
import Icon from './icons.jsx';

const COLUMNS = [{ label: 'Modelo' }, { label: 'Medidas' }, { label: 'Referencia' }, { label: 'Precio €' }, { label: 'Coste €' }];

function MoneyCell({ variant, field, editable, onSave }) {
  const [value, setValue] = useState(variant[field] ?? '');
  useEffect(() => setValue(variant[field] ?? ''), [variant[field]]);
  if (!editable) return <td className={`${cellClass} font-mono text-slate-600`}>{variant[field] ?? '—'}</td>;
  return (
    <td className={cellClass}>
      <input type="number" min="0" step="0.01" value={value} aria-label={`${field === 'unit_price' ? 'Precio' : 'Coste'} variante ${variant.id}`}
        onChange={e => setValue(e.target.value)}
        onBlur={() => String(value) !== String(variant[field] ?? '') && value !== '' && onSave(variant.id, { [field]: Number(value) })}
        className={`${inputClass} w-24 font-mono`} />
    </td>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [me, setMe] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = (query = q) => fetch(`${API_BASE}/api/products?q=${encodeURIComponent(query)}`, { headers: authHeaders() })
    .then(r => r.json()).then(setProducts);
  useEffect(() => {
    load('');
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() }).then(r => r.json()).then(setMe);
  }, []);

  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setNotice(''); setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_BASE}/api/catalog/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body,
      });
      const data = await res.json();
      if (!res.ok) return setError(typeof data.detail === 'string' ? data.detail : 'No se pudo leer el catálogo');
      setPreview(data);
    } catch {
      setError('Error de conexión');
    } finally {
      setUploading(false);
    }
  }

  async function saveVariant(id, patch) {
    setError('');
    const res = await fetch(`${API_BASE}/api/variants/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch) });
    if (!res.ok) setError('No se pudo guardar el cambio');
    load();
  }

  function done(result) {
    setPreview(null);
    setNotice(`Importación guardada: ${result.created} nuevas, ${result.overwritten} sobrescritas, ${result.kept} mantenidas, ${result.discarded} descartadas.`);
    load();
  }

  const canUpload = me && me.role !== 'admin_rrhh';
  const uploadButton = canUpload && (
    <label className="press inline-flex items-center gap-2 rounded-xl px-4 min-h-[40px] text-sm font-medium bg-accent-500 hover:bg-accent-400 text-night cursor-pointer">
      <Icon name="plus" className="h-4 w-4" />{uploading ? 'Leyendo catálogo…' : 'Subir catálogo PDF'}
      <input type="file" name="catalog-file" accept="application/pdf" className="sr-only" disabled={uploading} onChange={upload} />
    </label>
  );

  return (
    <AppShell active="catalog" title="Catálogo" subtitle="Los productos que se venden, compartidos por todo el equipo." actions={uploadButton}>
      <div className="flex flex-col gap-6">
        {error && <ErrorNote>{error}</ErrorNote>}
        {notice && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{notice}</p>}
        {preview && (
          <Card title="Revisa lo que se ha leído del PDF">
            <CatalogImportReview preview={preview} onDone={done} onCancel={() => setPreview(null)} />
          </Card>
        )}
        <Card title="Productos" style={{ '--i': 1 }}>
          <input type="search" placeholder="Buscar por modelo, medidas o referencia" value={q} aria-label="Buscar en el catálogo"
            onChange={e => { setQ(e.target.value); load(e.target.value); }} className={`${inputClass} mb-4`} />
          {products.some(p => p.variants.length) ? (
            <Table columns={COLUMNS}>
              {products.flatMap(p => p.variants.map(v => {
                const editable = me && canEdit(me, v);
                return (
                  <tr key={v.id} className={rowClass} data-testid="catalog-row">
                    <td className={`${cellClass} font-medium text-night`}>{p.name}</td>
                    <td className={`${cellClass} font-mono text-slate-600`}>{v.dimensions.join(' × ')}</td>
                    <td className={`${cellClass} text-slate-600`}>{v.reference || '—'}</td>
                    <MoneyCell variant={v} field="unit_price" editable={editable} onSave={saveVariant} />
                    <MoneyCell variant={v} field="unit_cost" editable={editable} onSave={saveVariant} />
                  </tr>
                );
              }))}
            </Table>
          ) : <Empty icon="box">{q ? 'Nada encaja con la búsqueda.' : 'Catálogo vacío. Sube un PDF para empezar.'}</Empty>}
        </Card>
      </div>
    </AppShell>
  );
}
