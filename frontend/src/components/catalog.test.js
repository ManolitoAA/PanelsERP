import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantLabel, variantOptions, pickVariant, pendingDecisions, canEdit } from './catalog.js';

const PRODUCTS = [{ name: 'BOLARDO PCK', variants: [
  { id: 7, dimensions: ['100', '430'], reference: null, unit_price: 15, unit_cost: 9, created_by: 1 },
  { id: 8, dimensions: ['120', '430'], reference: 'BP-120', unit_price: null, unit_cost: null, created_by: 2 },
] }];

test('variantLabel une modelo, medidas y referencia', () => {
  assert.equal(variantLabel(PRODUCTS[0], PRODUCTS[0].variants[0]), 'BOLARDO PCK 100 × 430');
  assert.equal(variantLabel(PRODUCTS[0], PRODUCTS[0].variants[1]), 'BOLARDO PCK 120 × 430 · BP-120');
});

test('variantOptions da una opción por variante', () => {
  assert.deepEqual(variantOptions(PRODUCTS).map(o => o.variant.id), [7, 8]);
});

test('pickVariant rellena precio y coste vacíos y guarda variant_id', () => {
  const line = { product_name: 'BOLARDO PCK 100 × 430', quantity: 2, unit_price: '', unit_cost: '' };
  assert.deepEqual(pickVariant(line, variantOptions(PRODUCTS)),
    { ...line, variant_id: 7, unit_price: '15', unit_cost: '9' });
});

test('pickVariant respeta lo escrito a mano', () => {
  const line = { product_name: 'BOLARDO PCK 100 × 430', unit_price: '16', unit_cost: '' };
  assert.equal(pickVariant(line, variantOptions(PRODUCTS)).unit_price, '16');
});

test('pickVariant quita variant_id si el texto ya no coincide', () => {
  const line = { product_name: 'Perfil libre', variant_id: 7, unit_price: '15', unit_cost: '9' };
  const out = pickVariant(line, variantOptions(PRODUCTS));
  assert.equal(out.variant_id, undefined);
  assert.equal(out.unit_price, '15');
});

test('pickVariant sin precio en catálogo deja el campo vacío', () => {
  const line = { product_name: 'BOLARDO PCK 120 × 430 · BP-120', unit_price: '', unit_cost: '' };
  const out = pickVariant(line, variantOptions(PRODUCTS));
  assert.equal(out.variant_id, 8);
  assert.equal(out.unit_price, '');
});

test('pendingDecisions cuenta conflictos y repetidas sin acción', () => {
  const preview = { products: [{ variants: [
    { status: 'nueva' }, { status: 'conflicto' }, { status: 'conflicto', action: 'mantener' }, { status: 'repetida' },
  ] }] };
  assert.equal(pendingDecisions(preview), 2);
});

test('canEdit: autor o jefe, nunca rrhh', () => {
  assert.equal(canEdit({ id: 1, role: 'comercial' }, { created_by: 1 }), true);
  assert.equal(canEdit({ id: 2, role: 'comercial' }, { created_by: 1 }), false);
  assert.equal(canEdit({ id: 3, role: 'jefe' }, { created_by: 1 }), true);
  assert.equal(canEdit({ id: 1, role: 'admin_rrhh' }, { created_by: 1 }), false);
});
