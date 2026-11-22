import { CONFIG } from '../config';
import { totalSpent, type Ledger, type LedgerEntry } from '../game/ledger';
import { formatCoins } from './coins';
import { h, keycap, panel, TEST } from './settingsView';

/**
 * The test ledger of the test lab: totals (bought, earned and spent apart),
 * the latest lines, a button to clear it and a field to set the balance.
 * It only shows and asks; the game owns the wallet and the ledger.
 */

/** What the ledger panel reads and may ask for. */
export interface WalletHooks {
  /** The wallet now. */
  balance(): number;
  /** The ledger now. */
  ledger(): Ledger;
  /** Empty the ledger and its totals. The wallet is untouched. */
  clear(): void;
  /** Set the wallet to `coins`. */
  setBalance(coins: number): void;
  /** What to call a level in the list, by level id (for example "level 3"). */
  levelNames?: Readonly<Record<string, string>>;
}

const ITEM: Record<string, string> = { hint: 'Hint', undo: 'Undo', extra_moves: `+${CONFIG.extraMoves} moves`, balance: 'Balance set' };
const two = (n: number): string => String(n).padStart(2, '0');

/** A ledger line in words: what it was, for the list. */
export function describeEntry(entry: LedgerEntry, names: Readonly<Record<string, string>> = {}): string {
  if (entry.kind === 'bought') return `Bought: ${names[entry.item] ?? entry.item}`;
  if (entry.kind === 'earned') return `Won: ${names[entry.item] ?? entry.item}`;
  if (entry.kind === 'spent') return `Spent: ${ITEM[entry.item] ?? entry.item}`;
  return ITEM[entry.item] ?? entry.item;
}

/** The time of a line as the list shows it: hours, minutes and seconds on the device's clock. */
export function clockTime(at: number): string {
  const d = new Date(at);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

const signed = (coins: number): string => `${coins > 0 ? '+' : coins < 0 ? '−' : ''}${formatCoins(Math.abs(coins))}`;

/** The ledger panel for the test lab. It redraws itself after every action. */
export function ledgerPanel(hooks: WalletHooks): HTMLElement {
  const p = panel('Coin ledger', TEST, 'Every pretend purchase, reward and spend on this device. Bought and earned coins are counted apart.');
  const body = h(`<div class="tf-led-body"></div>`);
  p.body.appendChild(body);
  const names = { ...hooks.levelNames, ...Object.fromEntries(CONFIG.shop.packs.map((pack) => [pack.id, pack.name])) };

  const draw = (): void => {
    const { entries, totals: t } = hooks.ledger();
    const total = (key: string, name: string, value: string, sum = false): string => `<div data-total="${key}"${sum ? ' class="sum"' : ''}><dt>${name}</dt><dd>${value}</dd></div>`;
    const shown = entries.slice(-CONFIG.shop.ledgerShown).reverse();
    body.innerHTML = `<dl class="tf-led-totals">
        ${total('bought', `Coins bought (${t.purchases} test purchase${t.purchases === 1 ? '' : 's'})`, formatCoins(t.bought))}
        ${total('earned', 'Coins earned by playing', formatCoins(t.earned))}
        ${total('spentHint', 'Spent on hints', formatCoins(t.spentHint))}
        ${total('spentUndo', 'Spent on Undo', formatCoins(t.spentUndo))}
        ${total('spentExtraMoves', `Spent on +${CONFIG.extraMoves} moves`, formatCoins(t.spentExtraMoves))}
        ${total('spent', 'Spent in total', formatCoins(totalSpent(t)), true)}
        ${total('balance', 'Balance now', formatCoins(hooks.balance()), true)}
      </dl>
      <div class="tf-led-set"><input id="ledgerBalance" type="number" inputmode="numeric" min="0" max="999999" step="1" value="${hooks.balance()}" aria-label="Balance to set, in coins" /></div>
      ${
        shown.length === 0
          ? `<p class="tf-led-empty">Nothing recorded yet.</p>`
          : `<ol class="tf-led-list" aria-label="Latest ledger lines, newest first">${shown
              .map((e) => `<li><span>${clockTime(e.at)}</span><span class="what">${describeEntry(e, names)}</span><span class="${e.coins >= 0 ? 'in' : 'out'}">${signed(e.coins)}</span><span class="bal">${formatCoins(e.balance)}</span></li>`)
              .join('')}</ol>`
      }`;
    const input = body.querySelector<HTMLInputElement>('#ledgerBalance')!;
    const set = keycap('tf-utility', 'Set balance', 130, 'id="ledgerSet"');
    set.addEventListener('click', () => {
      const coins = Math.floor(Number(input.value));
      if (!Number.isFinite(coins) || coins < 0 || coins > 999999) return;
      hooks.setBalance(coins);
      draw();
      body.querySelector<HTMLElement>('#ledgerSet')!.focus();
    });
    body.querySelector('.tf-led-set')!.appendChild(set);
    const clear = keycap('tf-utility', 'Clear ledger', 0, 'id="ledgerClear"');
    clear.disabled = entries.length === 0 && totalSpent(t) + t.bought + t.earned === 0;
    clear.addEventListener('click', () => {
      hooks.clear();
      draw();
      body.querySelector<HTMLElement>('#ledgerBalance')!.focus();
    });
    body.appendChild(clear);
  };
  draw();
  return p.panel;
}
