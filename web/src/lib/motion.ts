/** Reduced-motion flag + press-state binder (per-handoff press scales). */

const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

export function reducedMotion(): boolean {
  return mq.matches;
}

/**
 * Binds press feedback to every element with data-press="tile|button|icon|fab".
 * Fast press-down (0.08 s), springy release (0.45 s) — handled in CSS via .is-pressed.
 */
export function bindPressStates(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-press]').forEach((node) => {
    if (node.dataset.pressBound) return;
    node.dataset.pressBound = '1';
    node.classList.add(`press-${node.dataset.press}`);
    node.addEventListener('pointerdown', () => node.classList.add('is-pressed'));
    const release = () => node.classList.remove('is-pressed');
    node.addEventListener('pointerup', release);
    node.addEventListener('pointercancel', release);
    node.addEventListener('pointerleave', release);
  });
}
