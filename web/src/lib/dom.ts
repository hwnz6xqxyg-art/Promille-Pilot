/** Tiny DOM helpers — fine-grained updates without a framework. */

export function qs<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`element not found: ${sel}`);
  return el;
}

const lastText = new WeakMap<Element, string>();

/** Write textContent only when the string actually changed (cheap at 60 fps). */
export function setText(el: Element, s: string): void {
  if (lastText.get(el) === s) return;
  lastText.set(el, s);
  el.textContent = s;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
