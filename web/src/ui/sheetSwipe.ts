/**
 * Swipe-a-bottom-sheet-down-to-dismiss gesture, shared by the add-drink sheet
 * and the drink editor. Pull the sheet (anywhere that isn't a button) downward:
 * the CSS transform-transition is suspended so it tracks the finger 1:1 and the
 * backdrop dims proportionally, then control is handed back to CSS on release —
 * dismiss past ~30 % of the sheet height or a firm downward flick, else spring back.
 */
export function attachSwipeToDismiss(
  sheet: HTMLElement,
  backdrop: HTMLElement,
  onClose: () => void,
): void {
  let drag: { y: number; h: number; ty: number; vy: number; lastY: number; lastT: number } | null = null;

  sheet.addEventListener('pointerdown', (e) => {
    // Buttons stay pure taps; the text field stays focusable — never start a drag on them.
    if ((e.target as HTMLElement).closest('button, input, textarea, [contenteditable]')) return;
    sheet.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, h: sheet.offsetHeight, ty: 0, vy: 0, lastY: e.clientY, lastT: e.timeStamp };
    sheet.style.transition = 'none';
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const ty = Math.max(0, e.clientY - drag.y); // down is positive; can't drag above the open position
    drag.vy = (e.clientY - drag.lastY) / Math.max(1, e.timeStamp - drag.lastT);
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
    drag.ty = ty;
    sheet.style.transform = `translateY(${ty}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - ty / drag.h)); // dim lightens as the sheet pulls away
  });
  const release = (): void => {
    if (!drag) return;
    const d = drag;
    drag = null;
    // Hand animation back to the CSS transition, arming it with a reflow before the transform clears.
    sheet.style.transition = '';
    void sheet.offsetHeight;
    sheet.style.transform = '';
    backdrop.style.opacity = '';
    // Past ~30 % of the sheet height, or a firm downward flick, commits the dismiss.
    if (d.ty > d.h * 0.3 || d.vy > 0.6) onClose();
  };
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);
}
