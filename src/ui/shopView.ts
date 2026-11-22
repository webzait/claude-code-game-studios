import type { CoinPack, PurchaseResult } from '../game/shop';
import { formatExamplePrice } from '../game/shop';
import parts from '../../data/parts.json';
import { coinIcon, formatCoins } from './coins';

/**
 * The test shop: a sheet over whatever screen is open, so closing it leaves
 * the player exactly where they were. It lists the coin packs, asks for a
 * clear confirmation, shows a short "processing" moment and then a receipt
 * line. It never owns the wallet: it asks the game to buy and shows the answer.
 *
 * Honest by design, and meant to stay so when real payments exist: every pack
 * looks the same, none is pre-selected or highlighted, the price is on the
 * pack before the tap, there are no timers, discounts or urgency, and both
 * the list and the confirmation carry the "Test shop" label.
 *
 * Room for a parental gate (NOT built, see design/shop.md): it belongs between
 * the pack tap and the confirmation step, in `confirm` below.
 */

/** What the game tells the shop after a purchase attempt. */
export interface PurchaseReport {
  readonly result: PurchaseResult;
  /** The receipt line to show, already stating what happened to the balance. */
  readonly line: string;
}

/** What the shop asks of the game. */
export interface ShopHandlers {
  /** Buy a pack through the purchase layer and apply the outcome to the wallet. */
  buy(pack: CoinPack): Promise<PurchaseReport>;
  /** A button was tapped (for its sound). */
  tap(): void;
  /** The shop was closed. */
  closed(): void;
}

const btn = (id: string, kind: string, text: string): string =>
  `<button type="button" id="${id}" class="tf-btn ${kind}" style="--press-fraction:${parts.buttons.pressFraction}"><span class="tf-clip"><span class="tf-face"><span class="tf-label">${text}</span></span></span></button>`;
const TEST_LABEL = '<span class="tf-shop-test">Test shop</span>';
const escape = (text: string): string => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One pack of the list: name, coins and the example price, all visible before the tap. */
export function packMarkup(pack: CoinPack): string {
  const price = formatExamplePrice(pack.examplePriceCents);
  return `<button type="button" class="tf-shop-pack" data-pack="${escape(pack.id)}" aria-label="${escape(pack.name)}, ${pack.coins} coins, example price ${price}, test: nothing is charged">
    ${coinIcon(30)}<span class="tf-shop-what"><b>${escape(pack.name)}</b><span>${formatCoins(pack.coins)} coins</span></span><span class="tf-shop-price"><b>${price}</b><span>example price</span></span></button>`;
}

/** The confirmation step: the pack, its coins, the example price, and the statement that this is a test. */
export function confirmMarkup(pack: CoinPack): string {
  return `<div class="tf-shop-confirm" role="group" aria-labelledby="shopConfirmTitle">
    <h3 id="shopConfirmTitle" tabindex="-1">Buy this pack?</h3>
    <dl class="tf-shop-lines">
      <div><dt>Pack</dt><dd>${escape(pack.name)}</dd></div>
      <div><dt>Coins</dt><dd>+${formatCoins(pack.coins)}${coinIcon(18)}</dd></div>
      <div><dt>Example price</dt><dd>${formatExamplePrice(pack.examplePriceCents)}</dd></div>
    </dl>
    <p class="tf-shop-free">${TEST_LABEL}<span>This is a test. Nothing is charged.</span></p>
    <div class="tf-shop-actions">${btn('shopCancel', 'tf-utility', 'Cancel')}${btn('shopConfirm', 'tf-end-main', 'Confirm test purchase')}</div>
  </div>`;
}

/** The shop sheet. One instance serves every screen. */
export class ShopView {
  private root: HTMLElement;
  private body: HTMLElement;
  private receipt: HTMLElement;
  private closeButton: HTMLButtonElement;
  private opener: HTMLElement | null = null;
  private packs: readonly CoinPack[] = [];
  private processing = false;
  /** The element that gets the shop's own coin counter. */
  readonly balanceHost: HTMLElement;

  /** @param app The game's root element; the sheet is added to it. */
  constructor(app: HTMLElement, private handlers: ShopHandlers) {
    app.insertAdjacentHTML(
      'beforeend',
      `<section class="overlay tf-shop" id="shop" hidden>
        <div class="tf-shop-sheet" role="dialog" aria-modal="true" aria-labelledby="shopTitle" aria-describedby="shopNote">
          <header class="tf-shop-head"><h2 id="shopTitle" tabindex="-1">Coin shop</h2>${TEST_LABEL}<span id="shopCoins" data-no-plus></span></header>
          <p class="tf-shop-note" id="shopNote">This is a test shop. Nothing is charged; the prices are examples.</p>
          <div id="shopBody"></div>
          <p class="tf-shop-receipt" id="shopReceipt" role="status" aria-live="polite" hidden></p>
          ${btn('shopClose', 'tf-utility', 'Close')}
        </div>
      </section>`,
    );
    this.root = app.querySelector<HTMLElement>('#shop')!;
    this.body = this.root.querySelector<HTMLElement>('#shopBody')!;
    this.receipt = this.root.querySelector<HTMLElement>('#shopReceipt')!;
    this.closeButton = this.root.querySelector<HTMLButtonElement>('#shopClose')!;
    this.balanceHost = this.root.querySelector<HTMLElement>('#shopCoins')!;
    this.closeButton.addEventListener('click', () => {
      this.handlers.tap();
      this.close();
    });
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.isOpen) return;
      if (this.body.querySelector('.tf-shop-confirm')) this.list();
      else this.close();
    });
  }

  /** True while the sheet is on screen. */
  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Open the shop on its list. Focus returns to `opener` when it closes. */
  open(packs: readonly CoinPack[], opener: HTMLElement | null): void {
    this.packs = packs;
    this.opener = opener;
    this.root.hidden = false;
    this.say(null);
    this.list();
    this.root.querySelector<HTMLElement>('#shopTitle')!.focus({ preventScroll: true });
  }

  /** Close the shop. Ignored during the "processing" moment, so a purchase is never left half shown. */
  close(): void {
    if (!this.isOpen || this.processing) return;
    this.root.hidden = true;
    this.body.innerHTML = '';
    this.opener?.focus();
    this.opener = null;
    this.handlers.closed();
  }

  private say(report: PurchaseReport | null): void {
    this.receipt.hidden = report === null;
    this.receipt.textContent = report?.line ?? '';
    this.receipt.className = `tf-shop-receipt${report ? ` ${report.result.status}` : ''}`;
  }

  private list(): void {
    this.closeButton.hidden = false;
    this.body.innerHTML = `<div class="tf-shop-packs">${this.packs.map(packMarkup).join('')}</div>`;
    for (const button of Array.from(this.body.querySelectorAll<HTMLButtonElement>('.tf-shop-pack'))) {
      button.addEventListener('click', () => {
        const pack = this.packs.find((p) => p.id === button.dataset.pack);
        if (!pack) return;
        this.handlers.tap();
        this.confirm(pack);
      });
    }
  }

  /** The confirmation step. A parental gate, once real payments exist, would be asked here before this step is shown. */
  private confirm(pack: CoinPack): void {
    this.say(null);
    this.closeButton.hidden = true;
    this.body.innerHTML = confirmMarkup(pack);
    this.body.querySelector<HTMLElement>('#shopCancel')!.addEventListener('click', () => {
      this.handlers.tap();
      this.list();
      this.say({ result: { status: 'cancelled', pack }, line: 'Purchase cancelled. Nothing was charged and your coins did not change.' });
    });
    this.body.querySelector<HTMLElement>('#shopConfirm')!.addEventListener('click', () => {
      this.handlers.tap();
      void this.buy(pack);
    });
    // Focus goes to the heading, not to a button: a key still held must not confirm a purchase.
    this.body.querySelector<HTMLElement>('#shopConfirmTitle')!.focus({ preventScroll: true });
  }

  private async buy(pack: CoinPack): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this.body.innerHTML = `<div class="tf-shop-wait" role="status"><i aria-hidden="true"></i><span>Processing the test purchase…</span></div>`;
    const report = await this.handlers.buy(pack);
    this.processing = false;
    if (!this.isOpen) return;
    this.list();
    this.say(report);
  }
}
