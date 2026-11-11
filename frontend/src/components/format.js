// Utilidades puras de presentación (probadas con node --test en format.test.js).

export const eur = n => `${Number(n || 0).toFixed(2)} €`;

// Margen sobre facturado; sin facturación no hay margen que mostrar.
export function marginPct(billed, profit) {
  return billed > 0 ? `${((profit / billed) * 100).toFixed(1)} %` : '—';
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const [a, b] = [parts[0], parts[1] || ''];
  return (a[0] + (b[0] || a[1] || '')).toUpperCase();
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || '';
}
