/**
 * Spring integrators — the exact physics from the design handoff.
 * Integrated at substeps of <= 50 ms; snap when both delta and velocity are tiny.
 */

export class SpringValue {
  value: number;
  target: number;
  velocity = 0;

  constructor(
    initial: number,
    private stiffness: number,
    private damping: number,
    private snapDelta: number,
    private snapVel: number,
  ) {
    this.value = initial;
    this.target = initial;
  }

  get settled(): boolean {
    return this.value === this.target && this.velocity === 0;
  }

  /** Jump to the target immediately (reduced motion / init). */
  snap(to?: number): void {
    if (to !== undefined) this.target = to;
    this.value = this.target;
    this.velocity = 0;
  }

  /** Advance by dtMs; returns true while still animating. */
  tick(dtMs: number): boolean {
    let remaining = Math.max(0, dtMs) / 1000;
    while (remaining > 0) {
      const dt = Math.min(0.05, remaining);
      remaining -= dt;
      const a = this.stiffness * (this.target - this.value) - this.damping * this.velocity;
      this.velocity += a * dt;
      this.value += this.velocity * dt;
      if (Math.abs(this.target - this.value) < this.snapDelta && Math.abs(this.velocity) < this.snapVel) {
        this.value = this.target;
        this.velocity = 0;
        return false;
      }
    }
    return true;
  }
}

/** Displayed-BAC spring: a = 130·Δ − 21·v, snap |Δ|<0.0004 & |v|<0.002. */
export function bacSpring(initial = 0): SpringValue {
  return new SpringValue(initial, 130, 21, 0.0004, 0.002);
}

/** Time-shift spring-back: a = 95·Δ − 19·v, snap |Δ|<0.4 min & |v|<1.5 (prototype values). */
export function shiftSpring(initial = 0): SpringValue {
  return new SpringValue(initial, 95, 19, 0.4, 1.5);
}
