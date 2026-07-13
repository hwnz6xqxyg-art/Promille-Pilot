/**
 * Apple-Mail-style row actions: slide a list row leftward and action buttons
 * slide in from the right edge; release past half (or a firm flick) snaps them
 * open, otherwise the row springs back. Only one row is open at a time; any
 * pointer-down outside closes it; a tap on the open row's content just closes.
 * Taps and vertical scrolling stay untouched — the gesture only engages once a
 * pointer moves ≥ 8 px horizontally-dominant.
 */

/** White stroke icons for the action blobs (modern Mail look: squircle + glyph). */
export const SWIPE_EDIT_ICON =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
export const SWIPE_DELETE_ICON =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

interface OpenRow {
  row: HTMLElement;
  close: () => void;
}

let openRow: OpenRow | null = null;
let outsideCloserInstalled = false;

function installOutsideCloser(): void {
  if (outsideCloserInstalled) return;
  outsideCloserInstalled = true;
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (openRow && !openRow.row.contains(e.target as Node)) {
        openRow.close();
        openRow = null;
      }
    },
    true,
  );
}

export function attachSwipeActions(row: HTMLElement, content: HTMLElement, actions: HTMLElement): void {
  installOutsideCloser();

  let tx = 0; // current settled translateX (0 = closed, −width = open)
  let drag: { x: number; y: number; startTx: number; width: number; lastX: number; lastT: number; vx: number } | null = null;
  let swiping = false;
  let swallowClick = false;
  let actionsW = 0; // cached at drag start; used to derive the reveal progress

  const apply = (x: number): void => {
    content.style.transform = x ? `translateX(${x.toFixed(1)}px)` : '';
    // 0..1 reveal progress — the action blobs fade/scale in with the swipe.
    const w = actionsW || actions.offsetWidth || 1;
    row.style.setProperty('--swipe', Math.min(1, Math.max(0, -x / w)).toFixed(3));
  };
  const close = (): void => {
    tx = 0;
    apply(0);
  };
  const settle = (open: boolean, width: number): void => {
    tx = open ? -width : 0;
    apply(tx);
    if (open) {
      if (openRow && openRow.row !== row) openRow.close();
      openRow = { row, close };
    } else if (openRow?.row === row) {
      openRow = null;
    }
  };

  row.addEventListener('pointerdown', (e) => {
    // Taps on the revealed action buttons are plain clicks — never a gesture.
    if (actions.contains(e.target as Node)) return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      startTx: tx,
      width: Math.max(1, actions.offsetWidth),
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    };
    swiping = false;
  });

  row.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!swiping) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // undecided
      if (Math.abs(dy) > Math.abs(dx)) {
        drag = null; // vertical wins — the page scroll owns this pointer
        return;
      }
      swiping = true;
      actionsW = drag.width;
      row.classList.add('is-swiping'); // progress-linked blobs, no transitions mid-drag
      row.setPointerCapture(e.pointerId);
      content.style.transition = 'none';
    }
    drag.vx = (e.clientX - drag.lastX) / Math.max(1, e.timeStamp - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    let x = drag.startTx + dx;
    if (x > 0) x *= 0.3; // rubber past the closed edge
    if (x < -drag.width) x = -drag.width + (x + drag.width) * 0.3; // …and past open
    apply(x);
  });

  const release = (): void => {
    const d = drag;
    drag = null;
    if (!d || !swiping) {
      // Plain tap on an open row's content: just close it, swallow the tap.
      if (!swiping && tx !== 0 && d) {
        swallowClick = true;
        settle(false, d.width);
      }
      return;
    }
    swiping = false;
    swallowClick = true; // a real swipe must not fire the row's tap action
    row.classList.remove('is-swiping');
    content.style.transition = '';
    const current = d.startTx + (d.lastX - d.x);
    const open = d.vx < -0.5 ? true : d.vx > 0.5 ? false : current < -d.width / 2;
    settle(open, d.width);
  };
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', release);

  // Capture-phase: eat the click that trails a swipe (or an open-row closing tap).
  row.addEventListener(
    'click',
    (e) => {
      if (swallowClick) {
        swallowClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
}
