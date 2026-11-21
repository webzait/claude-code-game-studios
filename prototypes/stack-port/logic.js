// PROTOTYPE - NOT FOR PRODUCTION
// Stack Port rules and solver. No rendering in here: the same file runs in the browser
// (window.Logic) and in node (module.exports), so levels can be proven outside the game.
//
// A level:  { stacks: [[bottom..top], ...], cap: n | [n, ...], ships: [[first..last], ...],
//             berthCap: n, margin: n, hint: '' }
// A state:  { stacks, berth, ship, docked, loaded, moves, won }
//   ship    index of the ship at (or waiting for) the berth
//   docked  true while that ship lies at the berth; false while the berth is a storage pad
//   loaded  how many containers the docked ship already holds
// A place is a yard stack index (0..n-1) or 'S': the berth, which is the ship while one is
// docked and the storage pad while none is.
(function (root) {
  'use strict';

  function capOf(level, i) { return Array.isArray(level.cap) ? level.cap[i] : level.cap; }

  function start(level) {
    return {
      stacks: level.stacks.map(s => s.slice()), berth: [], ship: 0, docked: true,
      loaded: 0, moves: 0, won: false,
    };
  }

  function clone(s) {
    return {
      stacks: s.stacks.map(x => x.slice()), berth: s.berth.slice(), ship: s.ship,
      docked: s.docked, loaded: s.loaded, moves: s.moves, won: s.won,
    };
  }

  /** Why a move cannot be made, or '' when it can. */
  function refuse(level, s, from, to) {
    if (s.won) return 'won';
    if (from === to) return 'same';
    if (from === 'S') {
      if (s.docked) return 'ship-locked';         // loaded cargo stays loaded
      if (!s.berth.length) return 'empty';
    } else if (!s.stacks[from] || !s.stacks[from].length) return 'empty';
    const box = from === 'S' ? s.berth[s.berth.length - 1] : s.stacks[from][s.stacks[from].length - 1];
    if (to === 'S') {
      if (s.docked) return level.ships[s.ship][s.loaded] === box ? '' : 'wrong-colour';
      return s.berth.length < (level.berthCap || 0) ? '' : 'full';
    }
    if (!s.stacks[to]) return 'empty';
    return s.stacks[to].length < capOf(level, to) ? '' : 'full';
  }

  /** The state after a legal move; the result's .departed says a ship just left. */
  function move(level, s, from, to) {
    const n = clone(s);
    const box = from === 'S' ? n.berth.pop() : n.stacks[from].pop();
    n.moves++;
    n.departed = false;
    if (to === 'S' && n.docked) {
      n.loaded++;
      if (n.loaded === level.ships[n.ship].length) {
        n.departed = true; n.ship++; n.loaded = 0; n.docked = false;
        if (n.ship >= level.ships.length) n.won = true;
        else if (!(level.berthCap > 0)) n.docked = true; // no pad to use: the next ship comes straight in
      }
    } else if (to === 'S') n.berth.push(box);
    else n.stacks[to].push(box);
    return n;
  }

  /** The waiting ship may come in only when the pad is clear. */
  function canDock(level, s) {
    return !s.won && !s.docked && s.ship < level.ships.length && s.berth.length === 0;
  }
  function dock(level, s) { const n = clone(s); n.docked = true; n.departed = false; return n; }

  function key(s) {
    return s.stacks.map(x => x.join('')).join('|') + '/' + s.berth.join('') + '/' + s.ship +
      (s.docked ? 'd' : 'u') + s.loaded;
  }

  /**
   * Shortest solution from a state (default: the level's start), by 0-1 breadth-first search:
   * crane moves cost 1, calling the waiting ship in costs 0.
   * Returns { solvable, min, path, seen }; path is a list of [from, to] or ['dock'].
   */
  function solve(level, from, maxStates) {
    const first = from ? clone(from) : start(level);
    const limit = maxStates || 400000;
    const places = level.stacks.map((_, i) => i).concat(['S']);
    const best = new Map([[key(first), 0]]);
    const prev = new Map();
    const dq = [{ s: first, d: 0, k: key(first) }];
    while (dq.length) {
      const cur = dq.shift();
      if (best.get(cur.k) < cur.d) continue;
      if (cur.s.won) {
        const path = [];
        for (let k = cur.k; prev.has(k); k = prev.get(k).k) path.unshift(prev.get(k).m);
        return { solvable: true, min: cur.d, path, seen: best.size };
      }
      if (best.size > limit) return { solvable: null, min: null, path: null, seen: best.size };
      const push = (n, cost, m) => {
        const k = key(n), d = cur.d + cost;
        if (best.has(k) && best.get(k) <= d) return;
        best.set(k, d); prev.set(k, { k: cur.k, m });
        if (cost === 0) dq.unshift({ s: n, d, k }); else dq.push({ s: n, d, k });
      };
      if (canDock(level, cur.s)) push(dock(level, cur.s), 0, ['dock']);
      for (const a of places) for (const b of places) {
        if (refuse(level, cur.s, a, b) === '') push(move(level, cur.s, a, b), 1, [a, b]);
      }
    }
    return { solvable: false, min: null, path: null, seen: best.size };
  }

  const Logic = { capOf, start, clone, refuse, move, canDock, dock, solve, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
