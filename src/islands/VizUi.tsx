import type { ReactNode } from 'react';

/** HUD key/value rows (mono, right-aligned values). tone colours the value. */
export type Stat = { k: ReactNode; v: ReactNode; tone?: 'accent' | 'ok' | 'warn' | 'bad' | 'muted' };
export const StatPanel = ({ title, rows, children }: { title?: ReactNode; rows: Stat[]; children?: ReactNode }) => (
  <div className="stat-panel">
    {title && <p className="stat-title">{title}</p>}
    <dl>{rows.map((r, i) => <div key={i}><dt>{r.k}</dt><dd className={r.tone ? `tone-${r.tone}` : undefined}>{r.v}</dd></div>)}</dl>
    {children}
  </div>
);

export type Opt<T extends string> = { v: T; label: ReactNode };
export function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="ctl">
      <span className="ctl-label">{label}</span>
      <div className="pills" role="group" aria-label={label}>
        {options.map((o) => <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>)}
      </div>
    </div>
  );
}

export const Slider = ({ label, value, min, max, step = 1, fmt = String, onChange }:
  { label: string; value: number; min: number; max: number; step?: number; fmt?: (v: number) => string; onChange: (v: number) => void }) => (
  <label className="ctl">
    <span className="ctl-label">{label}: <b>{fmt(value)}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

/** Colour swatch + text for HUD legends. */
export const Key = ({ color, children, hollow }: { color: string; children: ReactNode; hollow?: boolean }) => (
  <span className="key"><i aria-hidden="true" style={hollow ? { border: `2px solid ${color}` } : { background: color }} />{children}</span>
);
