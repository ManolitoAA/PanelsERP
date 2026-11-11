// Lógica pura del catálogo (probada con node --test en catalog.test.js).

export const variantLabel = (product, v) =>
  `${product.name} ${v.dimensions.join(' × ')}`.trim() + (v.reference ? ` · ${v.reference}` : '');

export const variantOptions = products =>
  products.flatMap(p => p.variants.map(v => ({ label: variantLabel(p, v), variant: v })));

const filled = (current, fromCatalog) =>
  current !== '' && current != null ? current : (fromCatalog == null ? '' : String(fromCatalog));

// Si el texto del producto coincide con una variante, la vincula y rellena precio y coste vacíos.
export function pickVariant(line, options) {
  const match = options.find(o => o.label === line.product_name);
  if (!match) {
    const { variant_id, ...rest } = line;
    return rest;
  }
  const v = match.variant;
  return { ...line, variant_id: v.id, unit_price: filled(line.unit_price, v.unit_price), unit_cost: filled(line.unit_cost, v.unit_cost) };
}

export const pendingDecisions = preview =>
  preview.products.flatMap(p => p.variants).filter(v => v.status !== 'nueva' && !v.action).length;

export const canEdit = (me, variant) =>
  me.role === 'jefe' || (me.role === 'comercial' && variant.created_by === me.id);
