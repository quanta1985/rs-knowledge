import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Pills, StatPanel } from './VizUi';

// Starlink payloads launched and re-entered per year, and the number left in orbit (CelesTrak SATCAT).
const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/constellations/history.json`;
type Hist = { years: number[]; launched: number[]; reentered: number[]; launches: number[]; starship: number; onOrbit: number; total: number; lastLaunch: string;
  provenance: { retrieved: string } };

const TXT = {
  vi: { title: 'Vệ tinh Starlink phóng lên và rơi về khí quyển mỗi năm', launched: 'Phóng lên', reentered: 'Rơi về (cháy trong khí quyển)', orbit: 'Còn trên quỹ đạo cuối năm',
        launches: 'Số chuyến phóng', year: 'Năm', y: 'Số vệ tinh mỗi năm', partial: 'đến', total: 'Tổng đã phóng', now: 'Đang trên quỹ đạo', starship: 'Phóng bằng Starship',
        view: 'Hiện', both: 'Cả hai', up: 'Phóng lên', down: 'Rơi về', loading: 'Đang tải…', fail: 'Không tải được dữ liệu.' },
  en: { title: 'Starlink satellites launched and re-entered per year', launched: 'Launched', reentered: 'Re-entered (burned up)', orbit: 'In orbit at year end',
        launches: 'Launches', year: 'Year', y: 'Satellites per year', partial: 'to', total: 'Launched in total', now: 'In orbit now', starship: 'Launched on Starship',
        view: 'Show', both: 'Both', up: 'Launched', down: 'Re-entered', loading: 'Loading…', fail: 'Could not load the data.' },
};

export default function ConstellationHistory({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [h, setH] = useState<Hist | null>(null);
  const [error, setError] = useState(false);
  const [pick, setPick] = useState(-1);
  const [view, setView] = useState<'both' | 'up' | 'down'>('both');
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    let dead = false;
    fetch(URL_DATA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j: Hist) => { if (!dead) { setH(j); setPick(j.years.length - 2); } }).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [h]);

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!h) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number) => v.toLocaleString(loc);
  const orbit = h.years.map((_, k) => h.launched.slice(0, k + 1).reduce((a, b) => a + b, 0) - h.reentered.slice(0, k + 1).reduce((a, b) => a + b, 0));
  const last = h.years.length - 1, partial = `${h.years[last]} (${T.partial} ${h.lastLaunch.slice(8, 10)}/${h.lastLaunch.slice(5, 7)})`;
  const L = 64, R = 10, TOP = 22, H = 320, B = H - 44, max = 3500;
  const band = (W - L - R) / h.years.length, bw = view === 'both' ? Math.min(26, band * 0.34) : Math.min(44, band * 0.6);
  const sy = (v: number) => B - (v / max) * (B - TOP);
  const k = Math.max(0, pick);
  const bars = (view === 'both' ? ['up', 'down'] : [view]) as ('up' | 'down')[];

  return (
    <div className="dark-card">
      <div ref={box}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.title}>
          <title>{T.title}</title>
          <g className="grid">{[0, 1000, 2000, 3000].map((v) => <line key={v} x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />)}</g>
          <g className="axis">{[0, 1000, 2000, 3000].map((v) => <text key={v} x={L - 6} y={sy(v) + 4} textAnchor="end">{nf(v)}</text>)}</g>
          {h.years.map((y, i) => {
            const cx = L + band * (i + 0.5);
            return <g key={y} style={{ cursor: 'pointer' }} onClick={() => setPick(i)}>
              <rect x={cx - band / 2} y={TOP - 10} width={band} height={B - TOP + 30} style={{ fill: i === k ? 'var(--surface-2)' : 'transparent' }} />
              {bars.map((b, j) => {
                const v = b === 'up' ? h.launched[i] : h.reentered[i], x = cx + (bars.length === 2 ? (j === 0 ? -bw - 1 : 1) : -bw / 2);
                return <g key={b}>
                  <rect x={x} y={sy(v)} width={bw} height={B - sy(v)} rx={2} style={{ fill: b === 'up' ? 'var(--chart-1)' : 'var(--chart-6)' }} />
                  {(W > 520 || i === k) && <text x={x + bw / 2} y={sy(v) - 4} textAnchor="middle" style={{ fontSize: 10 }}>{nf(v)}</text>}
                </g>;
              })}
              <text x={cx} y={B + 16} textAnchor="middle" style={{ fill: i === k ? 'var(--fg)' : undefined, fontWeight: i === k ? 700 : 400 }}>{W < 520 ? `’${String(y).slice(2)}` : y}{i === last ? '*' : ''}</text>
            </g>;
          })}
          <text transform={`translate(12 ${(TOP + B) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 12 }}>{T.y}</text>
          <text x={W - R} y={H - 6} textAnchor="end" style={{ fontSize: 11 }}>* {partial}</text>
        </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={`${T.year} ${k === last ? partial : h.years[k]}`} rows={[
          { k: T.launched, v: nf(h.launched[k]), tone: 'accent' },
          { k: T.reentered, v: nf(h.reentered[k]), tone: 'bad' },
          { k: T.launches, v: nf(h.launches[k]) },
          { k: T.orbit, v: nf(orbit[k]), tone: 'ok' },
        ]} />
        <StatPanel title="SATCAT" rows={[
          { k: T.total, v: nf(h.total) },
          { k: T.now, v: nf(h.onOrbit), tone: 'ok' },
          { k: T.starship, v: nf(h.starship), tone: 'muted' },
        ]} />
        <div className="legend" style={{ marginTop: 8 }}>
          <span><i aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 10, borderRadius: 2, background: 'var(--chart-1)', marginRight: 6 }} />{T.launched}</span>
          <span><i aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 10, borderRadius: 2, background: 'var(--chart-6)', marginRight: 6 }} />{T.reentered}</span>
        </div>
      </div>
      <div className="bar-static">
        <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'both', label: T.both }, { v: 'up', label: T.up }, { v: 'down', label: T.down }]} />
        <Pills label={T.year} value={String(k)} onChange={(v) => setPick(Number(v))} options={h.years.map((y, i) => ({ v: String(i), label: String(y) }))} />
      </div>
    </div>
  );
}
