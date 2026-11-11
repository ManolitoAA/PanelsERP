import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eur, marginPct, initials, greeting, firstName } from './format.js';

test('eur formatea con dos decimales', () => {
  assert.equal(eur(3000), '3000.00 €');
  assert.equal(eur(undefined), '0.00 €');
});

test('marginPct: Caso 1 da 40 % y sin facturación no hay margen', () => {
  assert.equal(marginPct(3000, 1200), '40.0 %');
  assert.equal(marginPct(100, -30), '-30.0 %');
  assert.equal(marginPct(0, 0), '—');
});

test('initials toma nombre y apellido, o dos letras de una sola palabra', () => {
  assert.equal(initials('Comercial Uno'), 'CU');
  assert.equal(initials('hans'), 'HA');
  assert.equal(initials('  '), '?');
});

test('greeting cambia según la hora', () => {
  assert.equal(greeting(new Date(2026, 0, 1, 9)), 'Buenos días');
  assert.equal(greeting(new Date(2026, 0, 1, 16)), 'Buenas tardes');
  assert.equal(greeting(new Date(2026, 0, 1, 23)), 'Buenas noches');
  assert.equal(greeting(new Date(2026, 0, 1, 3)), 'Buenas noches');
});

test('firstName devuelve la primera palabra', () => {
  assert.equal(firstName('Ana López'), 'Ana');
  assert.equal(firstName(''), '');
});
