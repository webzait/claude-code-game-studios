import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import { DEFAULT_LAB } from '../../src/game/lab';
import { emptyLedger, readLedger, record, totalSpent, type LedgerEntry } from '../../src/game/ledger';
import { defaultSave, loadSave, migrate, resetProgress, SAVE_KEY, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { configuredPacks, formatExamplePrice, plusOpens, PURCHASE_OUTCOMES, receiptLine, SimulatedProvider, walletAfter, type CoinPack, type PurchaseOutcome, type PurchaseProvider } from '../../src/game/shop';
import { clockTime, describeEntry } from '../../src/ui/ledgerView';
import { confirmMarkup, packMarkup } from '../../src/ui/shopView';

const PACKS: CoinPack[] = [
  { id: 'small', name: 'Small pack', coins: 100, examplePriceCents: 99 },
  { id: 'large', name: 'Large pack', coins: 700, examplePriceCents: 499 },
];
const START = config.coins.start;
const MAX = config.shop.ledgerMax;
/** A provider whose outcome the test sets, and which records the waits it was asked for instead of waiting. */
function provider(outcome: PurchaseOutcome): { shop: PurchaseProvider; waits: number[] } {
  const waits: number[] = [];
  const shop = new SimulatedProvider(() => PACKS, { outcome: () => outcome, delay: (ms) => Promise.resolve(void waits.push(ms)), processingMs: 900 });
  return { shop, waits };
}
const entry = (kind: LedgerEntry['kind'], item: string, coins: number, balance: number, at = 1000): LedgerEntry => ({ at, kind, item, coins, balance });
const memory = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('simulated purchase provider', () => {
  it('is marked as simulated and lists the packs it was given', async () => {
    const { shop } = provider('success');
    expect(shop.simulated).toBe(true);
    expect(await shop.listPacks()).toEqual(PACKS);
  });

  it('a successful purchase names the pack, gives a test receipt and waits out the processing moment', async () => {
    const { shop, waits } = provider('success');
    const first = await shop.buy('small');
    const second = await shop.buy('large');
    expect(first).toEqual({ status: 'success', pack: PACKS[0], receipt: 'TEST-0001' });
    expect(second).toMatchObject({ status: 'success', pack: PACKS[1], receipt: 'TEST-0002' });
    expect(waits).toEqual([900, 900]);
  });

  it('a cancelled and a failed purchase say so and carry no receipt', async () => {
    expect(await provider('cancelled').shop.buy('small')).toEqual({ status: 'cancelled', pack: PACKS[0] });
    const failed = await provider('failed').shop.buy('small');
    expect(failed.status).toBe('failed');
    expect(failed).not.toHaveProperty('receipt');
  });

  it('an unknown pack fails, whatever the outcome switch says', async () => {
    const result = await provider('success').shop.buy('nope');
    expect(result.status).toBe('failed');
    expect(walletAfter(START, result)).toBe(START);
  });

  it('only a success changes the wallet, by exactly the pack', async () => {
    expect(walletAfter(START, await provider('success').shop.buy('small'))).toBe(START + PACKS[0].coins);
    expect(walletAfter(START, await provider('cancelled').shop.buy('small'))).toBe(START);
    expect(walletAfter(START, await provider('failed').shop.buy('small'))).toBe(START);
  });

  it('every receipt line says nothing was charged, and the unhappy ones that the coins did not change', async () => {
    for (const outcome of PURCHASE_OUTCOMES) {
      const result = await provider(outcome).shop.buy('small');
      const line = receiptLine(result, walletAfter(START, result));
      expect(line).toMatch(/[Nn]othing was charged/);
      if (outcome === 'success') expect(line).toContain(`+${PACKS[0].coins} coins`);
      else expect(line).toContain(`did not change: ${START}`);
    }
  });
});

describe('coin packs in the data file', () => {
  const packs = configuredPacks();

  it('are three or four whole packs, cheapest first, with unique ids', () => {
    expect(packs.length).toBeGreaterThanOrEqual(3);
    expect(packs.length).toBeLessThanOrEqual(4);
    expect(packs.length).toBe(config.shop.packs.length);
    expect(new Set(packs.map((p) => p.id)).size).toBe(packs.length);
    for (let i = 1; i < packs.length; i++) {
      expect(packs[i].examplePriceCents).toBeGreaterThan(packs[i - 1].examplePriceCents);
      expect(packs[i].coins).toBeGreaterThan(packs[i - 1].coins);
    }
  });

  it('a bigger pack is never worse value than a smaller one', () => {
    for (let i = 1; i < packs.length; i++) expect(packs[i].coins / packs[i].examplePriceCents).toBeGreaterThanOrEqual(packs[i - 1].coins / packs[i - 1].examplePriceCents);
  });

  it('entries that are not a whole pack are left out', () => {
    expect(configuredPacks([{ id: 'a', name: 'A', coins: 10, examplePriceCents: 50 }, { id: 'b', name: 'B', coins: 0, examplePriceCents: 50 }, { id: 'c', coins: 5, examplePriceCents: 50 }, { id: 'd', name: 'D', coins: 5 }])).toEqual([
      { id: 'a', name: 'A', coins: 10, examplePriceCents: 50 },
    ]);
  });

  it('example prices are written in euros and cents', () => {
    expect(formatExamplePrice(99)).toBe('€0.99');
    expect(formatExamplePrice(1005)).toBe('€10.05');
  });
});

describe('shop markup', () => {
  it('a pack shows its name, coins and example price before the tap, and looks like every other pack', () => {
    const html = PACKS.map(packMarkup);
    for (const [i, pack] of PACKS.entries()) {
      expect(html[i]).toContain(pack.name);
      expect(html[i]).toContain(`${pack.coins} coins`);
      expect(html[i]).toContain(formatExamplePrice(pack.examplePriceCents));
      expect(html[i]).toContain('example price');
      expect(html[i]).toContain('nothing is charged');
    }
    const classes = html.map((h) => /class="([^"]*)"/.exec(h)![1]);
    expect(new Set(classes)).toEqual(new Set(['tf-shop-pack']));
  });

  it('the confirmation names the pack, the coins and the example price, and says it is a test', () => {
    const html = confirmMarkup(PACKS[1]);
    expect(html).toContain(PACKS[1].name);
    expect(html).toContain(`+${PACKS[1].coins}`);
    expect(html).toContain(formatExamplePrice(PACKS[1].examplePriceCents));
    expect(html).toContain('Test shop');
    expect(html).toContain('This is a test. Nothing is charged.');
    expect(html).toContain('Cancel');
  });

  it('carries no pressure wording', () => {
    const text = (PACKS.map(packMarkup).join(' ') + confirmMarkup(PACKS[0])).toLowerCase();
    for (const word of ['best value', 'popular', 'last chance', 'limited', 'only today', 'hurry', 'sale', '% off', 'bonus']) expect(text).not.toContain(word);
  });
});

describe('ledger', () => {
  it('records lines oldest first and counts bought, earned and each kind of spend apart', () => {
    const ledger = emptyLedger();
    record(ledger, entry('bought', 'small', 100, 130), MAX);
    record(ledger, entry('earned', 'level-a', 26, 156), MAX);
    record(ledger, entry('spent', 'hint', -10, 146), MAX);
    record(ledger, entry('spent', 'undo', -5, 141), MAX);
    record(ledger, entry('spent', 'undo', -5, 136), MAX);
    record(ledger, entry('spent', 'extra_moves', -25, 111), MAX);
    record(ledger, entry('bought', 'large', 700, 811), MAX);
    expect(ledger.entries.map((e) => e.balance)).toEqual([130, 156, 146, 141, 136, 111, 811]);
    expect(ledger.totals).toEqual({ bought: 800, purchases: 2, earned: 26, spentHint: 10, spentUndo: 10, spentExtraMoves: 25 });
    expect(totalSpent(ledger.totals)).toBe(45);
  });

  it('setting the balance is a line of its own and changes no total', () => {
    const ledger = emptyLedger();
    record(ledger, entry('set', 'balance', -25, 5), MAX);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.totals).toEqual(emptyLedger().totals);
  });

  it('keeps only the latest lines, while the totals keep counting', () => {
    const ledger = emptyLedger();
    for (let i = 1; i <= 5; i++) record(ledger, entry('spent', 'undo', -5, 100 - 5 * i, i), 3);
    expect(ledger.entries.map((e) => e.at)).toEqual([3, 4, 5]);
    expect(ledger.totals.spentUndo).toBe(25);
  });

  it('reads a stored ledger back unchanged, and drops damaged lines and totals', () => {
    const ledger = emptyLedger();
    record(ledger, entry('bought', 'small', 100, 130), MAX);
    record(ledger, entry('spent', 'hint', -10, 120), MAX);
    expect(readLedger(JSON.parse(JSON.stringify(ledger)), MAX)).toEqual(ledger);
    const damaged = readLedger({ entries: [entry('bought', 'small', 100, 130), { at: 'now', kind: 'bought' }, { at: 1, kind: 'gift', item: 'x', coins: 1, balance: 1 }, null], totals: { bought: 100, purchases: -2, earned: 'lots' } }, MAX);
    expect(damaged.entries).toEqual([entry('bought', 'small', 100, 130)]);
    expect(damaged.totals).toEqual({ ...emptyLedger().totals, bought: 100 });
    expect(readLedger('nonsense', MAX)).toEqual(emptyLedger());
  });

  it('describes a line in words and shows its time on the clock', () => {
    expect(describeEntry(entry('bought', 'small', 100, 130), { small: 'Small pack' })).toBe('Bought: Small pack');
    expect(describeEntry(entry('earned', 'level-a', 26, 156), { 'level-a': 'level 3' })).toBe('Won: level 3');
    expect(describeEntry(entry('spent', 'undo', -5, 151))).toBe('Spent: Undo');
    expect(describeEntry(entry('spent', 'extra_moves', -25, 126))).toBe(`Spent: +${config.extraMoves} moves`);
    expect(describeEntry(entry('set', 'balance', -100, 26))).toBe('Balance set');
    expect(clockTime(new Date(2026, 10, 22, 9, 5, 7).getTime())).toBe('09:05:07');
  });
});

describe('save with the test shop', () => {
  const ids = ['level-a', 'level-b'];

  it('a fresh save has an empty ledger and the shop switches at their defaults', () => {
    const save = defaultSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.ledger).toEqual(emptyLedger());
    expect(save.lab.shop).toBe(true);
    expect(save.lab.purchaseOutcome).toBe('success');
  });

  it('a version 5 save keeps progress, coins and lab choices, and gains an empty ledger and the shop defaults', () => {
    const save = migrate({ version: 5, best: { 'level-a': 4 }, coins: 73, paid: { 'level-a': 26 }, settings: { mute: true, colourShapes: true }, lab: { freeHelp: true, board: 'classic' } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ 'level-a': 4 });
    expect(save.coins).toBe(73);
    expect(save.paid).toEqual({ 'level-a': 26 });
    expect(save.settings).toMatchObject({ mute: true, colourShapes: true });
    expect(save.lab).toEqual({ ...DEFAULT_LAB, freeHelp: true, board: 'classic' });
    expect(save.ledger).toEqual(emptyLedger());
  });

  it('the ledger and the shop switches survive a write and a read', () => {
    const store = memory();
    const save = defaultSave();
    record(save.ledger, entry('bought', 'small', 100, 130), MAX);
    record(save.ledger, entry('spent', 'undo', -5, 125), MAX);
    save.coins = 125;
    save.lab.shop = false;
    save.lab.purchaseOutcome = 'failed';
    expect(writeSave(store, save)).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
    expect(loadSave(store, ids)).toEqual(save);
  });

  it('a stored ledger longer than the limit is cut to the latest lines', () => {
    const entries = Array.from({ length: MAX + 5 }, (_, i) => entry('spent', 'undo', -5, 1000 - i, i));
    const save = migrate({ version: SAVE_VERSION, ledger: { entries, totals: {} } }, ids);
    expect(save.ledger.entries).toHaveLength(MAX);
    expect(save.ledger.entries[0].at).toBe(5);
  });

  it('resetting progress keeps the ledger', () => {
    const save = defaultSave();
    record(save.ledger, entry('bought', 'small', 100, 130), MAX);
    save.coins = 130;
    const reset = resetProgress(save);
    expect(reset.coins).toBe(START);
    expect(reset.ledger).toEqual(save.ledger);
  });
});

describe('lab switches for the shop', () => {
  const ids: string[] = [];

  it('the shop switch decides what the plus button opens', () => {
    expect(plusOpens(DEFAULT_LAB)).toBe('shop');
    expect(plusOpens({ ...DEFAULT_LAB, shop: false })).toBe('explainer');
  });

  it('stored switches are kept, and unknown values fall back to the defaults', () => {
    expect(migrate({ version: SAVE_VERSION, lab: { shop: false } }, ids).lab.shop).toBe(false);
    expect(migrate({ version: SAVE_VERSION, lab: { shop: 'yes' } }, ids).lab.shop).toBe(true);
    for (const outcome of PURCHASE_OUTCOMES) expect(migrate({ version: SAVE_VERSION, lab: { purchaseOutcome: outcome } }, ids).lab.purchaseOutcome).toBe(outcome);
    expect(migrate({ version: SAVE_VERSION, lab: { purchaseOutcome: 'refunded' } }, ids).lab.purchaseOutcome).toBe('success');
  });

  it('the outcome switch is read at the moment of buying, so changing it needs no restart', async () => {
    const lab = { ...DEFAULT_LAB };
    const shop = new SimulatedProvider(() => PACKS, { outcome: () => lab.purchaseOutcome, delay: () => Promise.resolve(), processingMs: 0 });
    expect((await shop.buy('small')).status).toBe('success');
    lab.purchaseOutcome = 'cancelled';
    expect((await shop.buy('small')).status).toBe('cancelled');
    lab.purchaseOutcome = 'failed';
    expect((await shop.buy('small')).status).toBe('failed');
  });

  it('free help is still its own switch and is off by default', () => {
    expect(DEFAULT_LAB.freeHelp).toBe(false);
    const save = migrate({ version: SAVE_VERSION, lab: { freeHelp: true, shop: false } }, ids);
    expect(save.lab.freeHelp).toBe(true);
    expect(save.lab.shop).toBe(false);
  });
});
