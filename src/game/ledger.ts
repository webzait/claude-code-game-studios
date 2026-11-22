/**
 * The test ledger: every pretend purchase, every reward and every spend, kept
 * in the save so prices can be judged after a play session. Bought coins and
 * earned coins are counted apart. Nothing here leaves the device.
 */

/** What coins were spent on. */
export type SpendItem = 'hint' | 'undo' | 'extra_moves';

/** One line of the ledger. */
export interface LedgerEntry {
  /** When it happened, in milliseconds since 1970. */
  readonly at: number;
  /** `bought`: a pretend purchase. `earned`: a level reward. `spent`: help paid for. `set`: the balance was set by hand or reset. */
  readonly kind: 'bought' | 'earned' | 'spent' | 'set';
  /** The pack id, the level id, the thing paid for (`hint`, `undo`, `extra_moves`), or `balance` for a set. */
  readonly item: string;
  /** Change to the wallet: positive in, negative out. */
  readonly coins: number;
  /** The wallet after this line. */
  readonly balance: number;
}

/** Running totals. They cover everything since the ledger was last cleared, also lines that have dropped off the list. */
export interface LedgerTotals {
  /** Coins from pretend purchases. */
  bought: number;
  /** Number of pretend purchases. */
  purchases: number;
  /** Coins earned by winning levels. */
  earned: number;
  spentHint: number;
  spentUndo: number;
  spentExtraMoves: number;
}

/** The ledger as it is saved. */
export interface Ledger {
  /** Oldest first; only the latest lines are kept. */
  entries: LedgerEntry[];
  totals: LedgerTotals;
}

/** An empty ledger. */
export function emptyLedger(): Ledger {
  return { entries: [], totals: { bought: 0, purchases: 0, earned: 0, spentHint: 0, spentUndo: 0, spentExtraMoves: 0 } };
}

const SPEND_KEY: Record<SpendItem, 'spentHint' | 'spentUndo' | 'spentExtraMoves'> = { hint: 'spentHint', undo: 'spentUndo', extra_moves: 'spentExtraMoves' };
const isSpendItem = (item: string): item is SpendItem => item in SPEND_KEY;

/**
 * Add a line and count it in the totals. The list keeps the latest `max`
 * lines; the totals keep counting. A `set` line changes no total.
 */
export function record(ledger: Ledger, entry: LedgerEntry, max: number): void {
  ledger.entries.push(entry);
  if (ledger.entries.length > max) ledger.entries.splice(0, ledger.entries.length - max);
  const t = ledger.totals;
  if (entry.kind === 'bought') {
    t.bought += entry.coins;
    t.purchases++;
  } else if (entry.kind === 'earned') t.earned += entry.coins;
  else if (entry.kind === 'spent' && isSpendItem(entry.item)) t[SPEND_KEY[entry.item]] += -entry.coins;
}

/** Everything spent, over the three kinds of help. */
export function totalSpent(t: LedgerTotals): number {
  return t.spentHint + t.spentUndo + t.spentExtraMoves;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const KINDS = ['bought', 'earned', 'spent', 'set'];

/** Read a stored ledger. Damaged lines are dropped and damaged totals count as zero; anything else gives an empty ledger. */
export function readLedger(raw: unknown, max: number): Ledger {
  const ledger = emptyLedger();
  if (!isRecord(raw)) return ledger;
  if (Array.isArray(raw.entries)) {
    for (const e of raw.entries) {
      if (!isRecord(e) || typeof e.at !== 'number' || typeof e.kind !== 'string' || !KINDS.includes(e.kind) || typeof e.item !== 'string') continue;
      if (typeof e.coins !== 'number' || !Number.isFinite(e.coins) || typeof e.balance !== 'number' || !Number.isFinite(e.balance)) continue;
      ledger.entries.push({ at: e.at, kind: e.kind as LedgerEntry['kind'], item: e.item, coins: e.coins, balance: e.balance });
    }
    if (ledger.entries.length > max) ledger.entries.splice(0, ledger.entries.length - max);
  }
  if (isRecord(raw.totals)) {
    for (const key of Object.keys(ledger.totals) as (keyof LedgerTotals)[]) ledger.totals[key] = count(raw.totals[key]);
  }
  return ledger;
}
