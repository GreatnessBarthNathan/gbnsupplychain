const test = require('node:test');
const assert = require('node:assert/strict');
const { canMoveOrder, isSameState, riderInventoryStages, transitions } = require('./orderStages');

test('COD orders advance through confirmation, transport, rider pickup, and delivery', () => {
  assert.deepEqual(transitions.new, ['activated']);
  assert.deepEqual(transitions.activated, ['in_transit', 'failed']);
  assert.deepEqual(transitions.in_transit, ['at_state', 'failed']);
  assert.deepEqual(transitions.at_state, ['delivered', 'failed', 'returning']);
  assert.deepEqual(transitions.delivered, ['transferred']);
  assert.deepEqual(transitions.failed, ['returning']);
  assert.deepEqual(transitions.returning, ['returned']);
});

test('transferred and returned orders are terminal', () => {
  assert.deepEqual(transitions.transferred, []);
  assert.deepEqual(transitions.returned, []);
});

test('transferred orders can only be recorded after successful delivery', () => {
  assert.equal(canMoveOrder('delivered', 'transferred', null), true);
  assert.equal(canMoveOrder('at_state', 'transferred', null), false);
});

test('failed and returning items remain in rider inventory until delivered or returned', () => {
  assert.deepEqual(riderInventoryStages, ['at_state', 'failed', 'returning']);
  assert.equal(riderInventoryStages.includes('returned'), false);
  assert.equal(riderInventoryStages.includes('delivered'), false);
});

test('new orders cannot be marked delivered or failed before confirmation', () => {
  assert.equal(transitions.new.includes('delivered'), false);
  assert.equal(transitions.new.includes('failed'), false);
});

test('orders whose parcel was transferred cannot advance through the stage workflow', () => {
  assert.equal(canMoveOrder('failed', 'returning', null), true);
  assert.equal(canMoveOrder('failed', 'returning', 'replacement-order-id'), false);
});

test('rider assignment requires a non-empty state match regardless of case or outer whitespace', () => {
  assert.equal(isSameState(' Lagos ', 'lagos'), true);
  assert.equal(isSameState('Ogun', 'Lagos'), false);
  assert.equal(isSameState('', 'Lagos'), false);
  assert.equal(isSameState('Lagos', ''), false);
});
