const transitions = Object.freeze({
  new: ['activated'],
  activated: ['in_transit', 'failed'],
  in_transit: ['at_state', 'failed'],
  at_state: ['delivered', 'failed', 'returning'],
  failed: ['returning'],
  returning: ['returned'],
  delivered: ['transferred'],
  transferred: [],
  returned: []
});

const riderInventoryStages = Object.freeze(['at_state', 'failed', 'returning']);

function canMoveOrder(stage, nextStage, redirectedTo) {
  return !redirectedTo && transitions[stage]?.includes(nextStage) === true;
}

function isSameState(first, second) {
  return typeof first === 'string'
    && typeof second === 'string'
    && first.trim().length > 0
    && second.trim().length > 0
    && first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase();
}

module.exports = { canMoveOrder, isSameState, transitions, riderInventoryStages };
