import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesOrder, STATUS_TONE, SHIPPING_STATUSES } from './shipping.js';

const order = { id: 12, tracking_code: 'AB123', courier_name: 'SEUR' };

test('matchesOrder busca por cliente sin tildes, tracking, mensajería y número', () => {
  assert.ok(matchesOrder(order, 'Distribuciones Gómez', 'gomez'));
  assert.ok(matchesOrder(order, 'X', 'ab12'));
  assert.ok(matchesOrder(order, 'X', 'seur'));
  assert.ok(matchesOrder(order, 'X', '#12'));
  assert.ok(matchesOrder(order, 'X', '  '));
  assert.ok(!matchesOrder(order, 'X', 'dhl'));
  assert.ok(!matchesOrder({ id: 3 }, null, 'abc'));
});

test('cada estado de envío tiene tono', () => {
  for (const s of SHIPPING_STATUSES) assert.ok(STATUS_TONE[s]);
});
