const states = require('../../shared/nigerianStates.json');

function normalizeNigerianState(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLocaleLowerCase();
  return states.find((state) => state.toLocaleLowerCase() === normalized) || '';
}

module.exports = { normalizeNigerianState, states };
