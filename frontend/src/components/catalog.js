// Lógica pura del catálogo (probada con node --test en catalog.test.js).

export const variantLabel = (product, v) =>
  `${product.name} ${v.dimensions.join(' × ')}`.trim() + (v.reference ? ` · ${v.reference}` : '');

export const variantOptions = products =>
  products.flatMap(p => p.variants.map(v => ({ label: variantLabel(p, v), variant: v })));

const asField = value => (value == null ? '' : String(value));

// Si el texto del producto coincide con una variante, la vincula y rellena precio y coste.
// Un campo se rellena si está vacío o aún tiene lo que puso el catálogo (line.auto); lo escrito a mano manda.
export function pickVariant(line, options) {
  const match = options.find(o => o.label === line.product_name);
  if (!match) {
    const { variant_id, ...rest } = line;
    return rest;
  }
  const v = match.variant;
  const auto = line.auto || {};
  const next = { ...line, variant_id: v.id, auto: {} };
  for (const k of ['unit_price', 'unit_cost']) {
    const current = line[k] ?? '';
    if (current === '' || current === auto[k]) {
      next[k] = asField(v[k]);
      next.auto[k] = next[k];
    }
  }
  return next;
}

export const pendingDecisions = preview =>
  preview.products.flatMap(p => p.variants).filter(v => v.status !== 'nueva' && !v.action).length;

export const canEdit = (me, variant) =>
  me.role === 'jefe' || (me.role === 'comercial' && variant.created_by === me.id);
