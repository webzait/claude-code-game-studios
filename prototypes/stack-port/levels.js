// PROTOTYPE - NOT FOR PRODUCTION
// The levels, as data. Colours: Y yellow, R red, B blue, G green, P purple.
// stacks are bottom-to-top; a ship's order is loaded first-to-last (bottom-to-top on deck).
// cap: boxes a yard stack may hold. berthCap: boxes the empty berth holds between ships.
// margin: moves allowed over the solver's minimum. `node tools/verify.js` proves each level.
window.LEVELS = [
  { // 1: nothing can go wrong, every box wanted is already on top
    stacks: [['G', 'Y'], ['R'], ['G', 'B']], cap: 3, ships: [['Y', 'R', 'B']], berthCap: 0,
    margin: 3, hint: 'Tap a stack, then tap the ship',
  },
  { // 2: the first box is buried: set one aside
    stacks: [['Y', 'R'], ['B'], []], cap: 3, ships: [['Y', 'R', 'B']], berthCap: 0,
    margin: 3, hint: 'Yellow is buried: set red aside first',
  },
  { // 3: low stacks: where you set things aside now matters
    stacks: [['R', 'B'], ['Y', 'G'], []], cap: 2, ships: [['Y', 'R', 'B']], berthCap: 0,
    margin: 2, hint: 'Stacks hold two here',
  },
  { // 4: three buried boxes and one free stack
    stacks: [[], ['G', 'Y', 'R'], ['G', 'B', 'B'], ['G', 'Y', 'R']], cap: 3,
    ships: [['G', 'B', 'Y', 'R', 'G']], berthCap: 0, margin: 2, hint: '',
  },
  { // 5: two ships, a full yard: it cannot be done without the empty berth
    stacks: [['R', 'B', 'B'], ['R', 'Y', 'G']], cap: 3, ships: [['G'], ['R', 'B', 'Y', 'R', 'B']],
    berthCap: 2, margin: 2, hint: 'The empty berth is storage. Tap the next ship to call it in',
  },
];
if (typeof module !== 'undefined' && module.exports) module.exports = window.LEVELS;
