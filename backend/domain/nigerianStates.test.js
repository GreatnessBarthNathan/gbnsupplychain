const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNigerianState, states } = require('./nigerianStates');

test('state selector includes all 36 states and the Federal Capital Territory', () => {
  assert.equal(states.length, 37);
  assert.equal(states.includes('Lagos'), true);
  assert.equal(states.includes('Federal Capital Territory'), false);
  assert.equal(states.includes('FCT'), true);
});

test('Nigerian state input is normalized and invalid values are rejected', () => {
  assert.equal(normalizeNigerianState(' lagos '), 'Lagos');
  assert.equal(normalizeNigerianState('FCT'), 'FCT');
  assert.equal(normalizeNigerianState('Not a state'), '');
});
