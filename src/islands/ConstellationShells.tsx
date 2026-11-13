import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { altitudeKm, shellOf } from '../lib/constellation';
import { Pills, StatPanel } from './VizUi';

// Altitude × inclination of every object in the CelesTrak snapshot: the orbital shells appear as clusters.
const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/constellations/leo.json`;
type Fleet = 'Starlink' | 'OneWeb' | 'Kuiper' | 'Qianfan' | 'Guowang';
const FLEETS: Fleet[] = ['Starlink', 'OneWeb', 'Kuiper', 'Qianfan', 'Guowang'];
// Okabe-Ito + a distinct marker per fleet (shape redundancy)
const STYLE: Record<Fleet, { c: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' }> = {
  Starlink: { c: '#0072B2', shape: 'circle' }, OneWeb: { c: '#E69F00', shape: 'square' }, Kuiper: { c: '#D55E00', shape: 'triangle' },
  Qianfan: { c: '#CC79A7', shape: 'diamond' }, Guowang: { c: '#009E73', shape: 'cross' },
};
// licensed / filed shells (FCC 21-48, FCC 22-91, FCC 20-102; OneWeb 1200 km 87.9°)
const FILED: { fleet: Fleet; i: number; h: number }[] = [
  { fleet: 'Starlink', i: 53, h: 550 }, { fleet: 'Starlink', i: 53.2, h: 540 }, { fleet: 'Starlink', i: 70, h: 570 }, { fleet: 'Starlink', i: 97.6, h: 560 },
  { fleet: 'Starlink', i: 53, h: 525 }, { fleet: 'Starlink', i: 43, h: 530 }, { fleet: 'Starlink', i: 33, h: 535 },
  { fleet: 'Kuiper', i: 51.9, h: 630 }, { fleet: 'Kuiper', i: 42, h: 610 }, { fleet: 'Kuiper', i: 33, h: 590 }, { fleet: 'OneWeb', i: 87.9, h: 1200 },
];
const X0 = 25, X1 = 100, Y0 = 250, Y1 = 1250; // inclination (deg), altitude (km)

const TXT = {
  vi: { title: 'Độ cao và độ nghiêng của mọi vật thể trong ảnh chụp quỹ đạo', show: 'Hiện', all: 'Tất cả', x: 'Độ nghiêng (°)', y: 'Độ cao (km)',
        filed: 'Lớp theo giấy phép/hồ sơ', loading: 'Đang tải phần tử quỹ đạo…', fail: 'Không tải được dữ liệu.', objects: 'vật thể', shells: 'Các lớp',
        n: 'Số', alt: 'Độ cao TV', low: 'dưới 400 km', note: 'Mỗi điểm là một vật thể; độ cao = bán trục lớn − 6378 km. Vòng rỗng: lớp trong giấy phép FCC/hồ sơ, để so với nơi vệ tinh thật đang bay.' },
  en: { title: 'Altitude and inclination of every object in the orbital snapshot', show: 'Show', all: 'All', x: 'Inclination (°)', y: 'Altitude (km)',
        filed: 'Licensed/filed shell', loading: 'Loading orbital elements…', fail: 'Could not load the data.', objects: 'objects', shells: 'Shells',
        n: 'Count', alt: 'Median alt.', low: 'below 400 km', note: 'Each dot is one object; altitude = semi-major axis − 6378 km. Hollow rings: shells in the FCC licence/filing, to compare with where the satellites actually fly.' },
};

const Mark = ({ x, y, f, r = 2.6 }: { x: number; y: number; f: Fleet; r?: number }) => {
  const { c, shape } = STYLE[f];
  if (shape === 'circle') return <circle cx={x} cy={y} r={r} fill={c} />;
  if (shape === 'square') return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={c} />;
  if (shape === 'triangle') return <path d={`M${x},${y - r * 1.2} L${x + r * 1.1},${y + r} L${x - r * 1.1},${y + r} Z`} fill={c} />;
  if (shape === 'diamond') return <path d={`M${x},${y - r * 1.3} L${x + r * 1.1},${y} L${x},${y + r * 1.3} L${x - r * 1.1},${y} Z`} fill={c} />;
  return <path d={`M${x - r},${y - r} L${x + r},${y + r} M${x - r},${y + r} L${x + r},${y - r}`} stroke={c} strokeWidth={1.6} />;
};
const median = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1];

export default function ConstellationShells({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [rows, setRows] = useState<Record<Fleet, { i: number; h: number; shell: string }[]> | null>(null);
  const [error, setError] = useState(false);
  const [show, setShow] = useState<Fleet | 'all'>('all');
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    let dead = false;
    fetch(URL_DATA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((j) => {
      if (dead) return;
      setRows(Object.fromEntries(FLEETS.filter((f) => j.sats[f]).map((f) => [f, (j.sats[f] as number[][]).map((r) => {
        const s = { n: r[2], i: r[4] };
        return { i: r[4], h: altitudeKm(r[2]), shell: shellOf(s) };
      })])) as Record<Fleet, { i: number; h: number; shell: string }[]>);
    }).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows]);

  const L = 54, R = 14, TOP = 12, H = Math.round(Math.min(460, Math.max(320, W * 0.62))), B = H - 40;
  const sx = (i: number) => L + ((i - X0) / (X1 - X0)) * (W - L - R);
  const sy = (h: number) => TOP + ((Y1 - h) / (Y1 - Y0)) * (B - TOP);
  // one mark per (0.25°, 4 km) cell keeps the SVG light; colour order draws the big fleet first
  const marks = useMemo(() => {
    if (!rows) return [];
    const out: { f: Fleet; i: number; h: number }[] = [];
    for (const f of FLEETS) {
      if (!rows[f] || (show !== 'all' && show !== f)) continue;
      const seen = new Set<string>();
      for (const o of rows[f]) {
        if (o.h < Y0 || o.h > Y1 || o.i < X0 || o.i > X1) continue;
        const k = `${Math.round(o.i * 4)}:${Math.round(o.h / 4)}`;
        if (!seen.has(k)) { seen.add(k); out.push({ f, i: o.i, h: o.h }); }
      }
    }
    return out;
  }, [rows, show]);

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!rows) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fleets = FLEETS.filter((f) => rows[f]);
  const focus: Fleet = show === 'all' ? 'Starlink' : show;
  const groups = new Map<string, { i: number; h: number }[]>();
  for (const o of rows[focus]) groups.set(o.shell, [...(groups.get(o.shell) ?? []), o]);
  const shellRows = [...groups].filter(([, v]) => v.length >= 4).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="dark-card">
      <div ref={box}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.title}>
          <title>{T.title}</title>
          <g className="grid">
            {[30, 40, 50, 60, 70, 80, 90, 100].map((v) => <line key={`x${v}`} x1={sx(v)} x2={sx(v)} y1={TOP} y2={B} />)}
            {[300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200].map((v) => <line key={`y${v}`} x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />)}
          </g>
          <rect x={L} y={sy(400)} width={W - L - R} height={sy(Y0) - sy(400)} style={{ fill: 'var(--fg-3)', opacity: 0.08 }} />
          <text x={W - R - 4} y={sy(Y0) - 6} textAnchor="end" style={{ fontSize: 11 }}>{T.low}</text>
          {marks.map((m, k) => <Mark key={k} x={sx(m.i)} y={sy(m.h)} f={m.f} />)}
          {FILED.filter((s) => show === 'all' || s.fleet === show).map((s, k) =>
            <circle key={k} cx={sx(s.i)} cy={sy(s.h)} r={7} style={{ fill: 'none', stroke: 'var(--fg)', strokeWidth: 1.4, strokeDasharray: '2 2' }} />)}
          <g className="axis">
            {[30, 40, 50, 60, 70, 80, 90, 100].map((v) => <text key={v} x={sx(v)} y={B + 16} textAnchor="middle">{v}</text>)}
            {[300, 500, 700, 900, 1100].map((v) => <text key={v} x={L - 6} y={sy(v) + 4} textAnchor="end">{nf(v)}</text>)}
          </g>
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={{ fontSize: 12 }}>{T.x}</text>
          <text transform={`translate(13 ${(TOP + B) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 12 }}>{T.y}</text>
        </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={`${focus} · ${T.shells}`} rows={shellRows.slice(0, 6).map(([k, v]) => ({
          k: k === 'low' ? `< 400 km` : `${nf(median(v.map((o) => o.i)), 1)}°`,
          v: `${nf(v.length)} · ${nf(median(v.map((o) => o.h)))} km`, tone: k === 'low' ? 'muted' as const : undefined,
        }))}>
          <div className="legend" style={{ marginTop: 10, gap: '4px 12px' }}>
            {fleets.map((f) => <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width={12} height={12} aria-hidden="true"><Mark x={6} y={6} f={f} r={4} /></svg>{f} · {nf(rows[f].length)}</span>)}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width={14} height={14} aria-hidden="true"><circle cx={7} cy={7} r={5.5} style={{ fill: 'none', stroke: 'var(--fg)', strokeDasharray: '2 2' }} /></svg>{T.filed}</span>
          </div>
          <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.show} value={show} onChange={setShow} options={[{ v: 'all' as const, label: T.all }, ...fleets.map((f) => ({ v: f, label: f }))]} />
      </div>
    </div>
  );
}
