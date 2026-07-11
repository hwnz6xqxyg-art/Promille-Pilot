/**
 * Profile / onboarding full-screen cover — custom pointer sliders (with keyboard
 * support), segmented controls with sliding thumb, iOS-style switch.
 * Writes through to the store on every change (prototype behavior).
 */
import type { Store } from '../state/store';
import type { Sex } from '../engine';
import { qs, setText } from '../lib/dom';

interface SliderCfg {
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  format: (v: number) => string;
  labelEl: HTMLElement;
}

const LIMIT_VALUES = [0, 0.3, 0.5];

export class Onboarding {
  private cover = qs<HTMLElement>('#profileCover');
  private closeBtn = qs<HTMLButtonElement>('#profileClose');
  private cta = qs<HTMLButtonElement>('#profileCta');
  private sexSeg = qs<HTMLElement>('#sexSeg');
  private limitSeg = qs<HTMLElement>('#limitSeg');
  private limitBlock = qs<HTMLElement>('#limitBlock');
  private noviceSwitch = qs<HTMLButtonElement>('#noviceSwitch');

  constructor(private store: Store) {
    this.initSlider(qs<HTMLElement>('#weightSlider'), {
      min: 40, max: 160, step: 1,
      get: () => this.store.profile.weightKg,
      set: (v) => this.store.setProfile({ weightKg: v }),
      format: (v) => `${v} kg`,
      labelEl: qs<HTMLElement>('#weightLabel'),
    });
    this.initSlider(qs<HTMLElement>('#heightSlider'), {
      min: 140, max: 210, step: 1,
      get: () => this.store.profile.heightCm ?? 180,
      set: (v) => this.store.setProfile({ heightCm: v }),
      format: (v) => `${v} cm`,
      labelEl: qs<HTMLElement>('#heightLabel'),
    });

    this.sexSeg.querySelectorAll<HTMLButtonElement>('.segment-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.store.setProfile({ sex: btn.dataset.value as Sex });
        this.sync();
      });
    });
    this.limitSeg.querySelectorAll<HTMLButtonElement>('.segment-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.store.profile.isNovice) return;
        this.store.setProfile({ targetLimitPromille: Number(btn.dataset.value) });
        this.sync();
      });
    });
    this.noviceSwitch.addEventListener('click', () => {
      this.store.setProfile({ isNovice: !this.store.profile.isNovice });
      this.sync();
    });

    qs<HTMLButtonElement>('#profileBtn').addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());
    this.cta.addEventListener('click', () => {
      if (!this.store.onboarded) this.store.finishOnboarding();
      this.close();
    });

    this.sync();
    if (this.store.profileOpen) this.cover.classList.add('is-open');
  }

  open(): void {
    this.store.profileOpen = true;
    this.cover.classList.add('is-open');
  }

  close(): void {
    this.store.profileOpen = false;
    this.cover.classList.remove('is-open');
  }

  /** Reflect store state into all controls. */
  sync(): void {
    const p = this.store.profile;

    const sexThumb = this.sexSeg.querySelector<HTMLElement>('.segment-thumb')!;
    sexThumb.style.left = p.sex === 'male' ? '2px' : 'calc(50% + 0px)';
    this.sexSeg.querySelectorAll<HTMLButtonElement>('.segment-opt').forEach((btn) => {
      btn.setAttribute('aria-checked', String(btn.dataset.value === p.sex));
    });

    const limitIdx = Math.max(0, LIMIT_VALUES.indexOf(p.targetLimitPromille));
    const limitThumb = this.limitSeg.querySelector<HTMLElement>('.segment-thumb')!;
    limitThumb.style.left = `calc(${limitIdx * 33.333}% + 2px)`;
    this.limitSeg.querySelectorAll<HTMLButtonElement>('.segment-opt').forEach((btn) => {
      btn.setAttribute('aria-checked', String(Number(btn.dataset.value) === p.targetLimitPromille));
    });
    this.limitBlock.classList.toggle('is-dimmed', p.isNovice);

    this.noviceSwitch.setAttribute('aria-checked', String(p.isNovice));
    this.closeBtn.hidden = !this.store.onboarded;
    setText(this.cta, this.store.onboarded ? 'Fertig' : 'Los geht’s');
  }

  private initSlider(root: HTMLElement, cfg: SliderCfg): void {
    const fill = root.querySelector<HTMLElement>('.pp-slider-fill')!;
    const thumb = root.querySelector<HTMLElement>('.pp-slider-thumb')!;

    const apply = () => {
      const v = Math.max(cfg.min, Math.min(cfg.max, cfg.get()));
      const pct = `${(((v - cfg.min) / (cfg.max - cfg.min)) * 100).toFixed(2)}%`;
      fill.style.width = pct;
      thumb.style.left = pct;
      root.setAttribute('aria-valuenow', String(v));
      setText(cfg.labelEl, cfg.format(v));
    };

    const setFromX = (clientX: number) => {
      const rect = root.getBoundingClientRect();
      let f = (clientX - rect.left) / Math.max(1, rect.width);
      f = Math.max(0, Math.min(1, f));
      let val = cfg.min + f * (cfg.max - cfg.min);
      val = Math.round(val / cfg.step) * cfg.step;
      val = Math.round(val * 100) / 100;
      cfg.set(val);
      apply();
    };

    let dragging = false;
    root.addEventListener('pointerdown', (e) => {
      root.setPointerCapture(e.pointerId);
      dragging = true;
      setFromX(e.clientX);
    });
    root.addEventListener('pointermove', (e) => {
      if (dragging) setFromX(e.clientX);
    });
    const stop = () => { dragging = false; };
    root.addEventListener('pointerup', stop);
    root.addEventListener('pointercancel', stop);
    root.addEventListener('keydown', (e) => {
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? cfg.step
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -cfg.step
        : 0;
      if (!delta) return;
      e.preventDefault();
      cfg.set(Math.max(cfg.min, Math.min(cfg.max, cfg.get() + delta)));
      apply();
    });

    apply();
  }
}
