/**
 * Flip card: chart on the front, drink history on the back. A tap on either
 * face's flip button turns the card over (3D rotateY). The inner height is kept
 * in sync with the visible face (both faces are absolutely positioned) so the
 * card grows/shrinks with whichever side shows — the drinks list can be long,
 * the empty chart is short. Reduced-motion users get an instant swap (the
 * global transition-duration override handles it).
 */
import { qs } from '../lib/dom';

export class FlipCard {
  private card = qs<HTMLElement>('#flipCard');
  private inner = qs<HTMLElement>('#flipInner');
  private front = qs<HTMLElement>('#flipFront');
  private back = qs<HTMLElement>('#flipBack');
  private flipped = false;

  constructor() {
    this.card.querySelectorAll<HTMLButtonElement>('[data-flip]').forEach((btn) =>
      btn.addEventListener('click', () => this.toggle()),
    );
    // Keep the card height matched to the visible face as its content changes
    // (curve appears/disappears, drinks added/removed).
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this.syncHeight());
      ro.observe(this.front);
      ro.observe(this.back);
    }
    this.apply();
  }

  private toggle(): void {
    this.flipped = !this.flipped;
    this.apply();
  }

  private apply(): void {
    this.card.classList.toggle('is-flipped', this.flipped);
    this.front.setAttribute('aria-hidden', String(this.flipped));
    this.back.setAttribute('aria-hidden', String(!this.flipped));
    this.syncHeight();
  }

  private syncHeight(): void {
    const active = this.flipped ? this.back : this.front;
    this.inner.style.height = `${active.offsetHeight}px`;
  }
}
