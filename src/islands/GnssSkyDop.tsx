import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dopClass, dopQ, enEllipse } from '../lib/gnss';
import { Pills, Slider, StatPanel } from './VizUi';

// Hand-placed sky geometries (illustrative, not a real epoch): azimuth, elevation in degrees.
type Sky = [number, number][];
const PRESETS: Record<'open' | 'canyon' | 'corner', Sky> = {
  open: [[10, 72], [95, 40], [160, 25], [215, 55], [275, 30], [330, 18], [45, 15], [250, 80]],
  canyon: [[0, 35], [12, 62], [178, 48], [195, 70], [350, 80], [170, 28], [80, 7], [265, 5]],
  corner: [[40, 30], [60, 55], [75, 20], [95, 45], [110, 70], [55, 12], [130, 35], [85, 82]],
};
type PresetKey = keyof typeof PRESETS;
const S = 300, C = S / 2, R = 130; // sky plot size (px), centre, horizon radius
const D = Math.PI / 180;
const toXY = (az: number, el: number) => [C + ((90 - el) / 90) * R * Math.sin(az * D), C - ((90 - el) / 90) * R * Math.cos(az * D)];
const toAzEl = (x: number, y: number): [number, number] => {
  const dx = x - C, dy = C - y, r = Math.min(R, Math.hypot(dx, dy));
  return [((Math.atan2(dx, dy) / D) + 360) % 360, 90 - (r / R) * 90];
};

const TXT = {
  vi: { fig: 'Sky plot kéo được: tâm là thiên đỉnh, vòng ngoài là chân trời', preset: 'Bầu trời', open: 'Trời thoáng', canyon: 'Khe phố Bắc–Nam', corner: 'Dồn một góc trời',
        mask: 'Góc che', uere: 'Sai số đo khoảng cách (UERE)', used: 'Vệ tinh dùng được', sh: 'Sai số ngang 1σ', sv: 'Sai số đứng 1σ', q: 'Đánh giá (PDOP)',
        cls: ['Lý tưởng', 'Tốt', 'Trung bình', 'Yếu', 'Không đáng tin', 'Không định vị được'], ell: 'Elip sai số ngang 1σ', drag: 'Kéo từng vệ tinh (hoặc chọn rồi dùng phím mũi tên). Vùng tô đỏ nhạt là phần trời bị che dưới góc che; vệ tinh trong đó không được dùng.',
        axes: 'trục lớn', dir: 'hướng', none: '—' },
  en: { fig: 'Draggable sky plot: centre is the zenith, outer ring the horizon', preset: 'Sky', open: 'Open sky', canyon: 'N–S street canyon', corner: 'One corner of the sky',
        mask: 'Mask', uere: 'Range error (UERE)', used: 'Usable satellites', sh: 'Horizontal error 1σ', sv: 'Vertical error 1σ', q: 'Rating (PDOP)',
        cls: ['Ideal', 'Good', 'Moderate', 'Poor', 'Unreliable', 'No fix'], ell: 'Horizontal 1σ error ellipse', drag: 'Drag any satellite (or focus it and use the arrow keys). The shaded band is sky below the mask; satellites there are not used.',
        axes: 'major axis', dir: 'azimuth', none: '—' },
};

export default function GnssSkyDop({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [preset, setPreset] = useState<PresetKey>('open');
  const [sats, setSats] = useState<Sky>(PRESETS.open);
  const [mask, setMask] = useState(10);
  const [uere, setUere] = useState(3);
  const [drag, setDrag] = useState(-1);
  const used = sats.filter(([, el]) => el >= mask).map(([az, el]) => ({ az, el }));
  const Q = dopQ(used);
  const q = Q ? { gdop: Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2] + Q[3][3]), pdop: Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2]), hdop: Math.sqrt(Q[0][0] + Q[1][1]), vdop: Math.sqrt(Q[2][2]), tdop: Math.sqrt(Q[3][3]) } : null;
  const ell = Q ? enEllipse(Q) : null;
  const ci = dopClass(q?.pdop);
  const tone = (['ok', 'ok', 'warn', 'bad', 'bad', 'bad'] as const)[ci];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const pick = (k: PresetKey) => { setPreset(k); setSats(PRESETS[k]); };
  const moveTo = (i: number, azEl: [number, number]) => setSats((s) => s.map((p, j) => (j === i ? azEl : p)));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag < 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    moveTo(drag, toAzEl(((e.clientX - r.left) / r.width) * S, ((e.clientY - r.top) / r.height) * S));
  };
  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [az, el] = sats[i];
    moveTo(i, [(az + d[0] + 360) % 360, Math.max(0, Math.min(90, el + d[1]))]);
  };

  // error ellipse panel: scale so the largest plausible ellipse fits
  const E = 150, ec = E / 2, maxM = ell ? Math.max(ell.major * uere, 1) : 1;
  const scale = (ec - 18) / Math.max(maxM, 4);
  const rm = ((90 - mask) / 90) * R;
  const ring = (r: number) => `M${C - r},${C}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;

  return (
    <div className="dark-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${S} ${S}`} width="100%" role="group" aria-label={T.fig} style={{ maxWidth: 380, touchAction: 'none', flex: '1 1 300px' }}
          onPointerMove={onMove} onPointerUp={() => setDrag(-1)} onPointerLeave={() => setDrag(-1)}>
          <circle cx={C} cy={C} r={R} style={{ fill: 'var(--surface-2)', stroke: 'var(--border)' }} />
          {mask > 0 && <path fillRule="evenodd" d={`${ring(R)}${ring(rm)}`} style={{ fill: 'var(--bad)' }} opacity={0.14} />}
          {[30, 60].map((el) => <circle key={el} cx={C} cy={C} r={((90 - el) / 90) * R} fill="none" style={{ stroke: 'var(--border)' }} />)}
          <line x1={C - R} x2={C + R} y1={C} y2={C} style={{ stroke: 'var(--border)' }} />
          <line x1={C} x2={C} y1={C - R} y2={C + R} style={{ stroke: 'var(--border)' }} />
          {mask > 0 && <circle cx={C} cy={C} r={rm} fill="none" style={{ stroke: 'var(--bad)' }} strokeDasharray="4 3" />}
          {[30, 60].map((el) => <text key={el} x={C + 3} y={C - ((90 - el) / 90) * R + 11} style={{ fontSize: 9, fill: 'var(--fg-3)' }}>{el}°</text>)}
          {(['N', 'E', 'S', 'W'] as const).map((t, i) => { const [x, y] = toXY(i * 90, -7); return <text key={t} x={x} y={y + 4} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--fg-muted)' }}>{t}</text>; })}
          {sats.map(([az, el], i) => {
            const [x, y] = toXY(az, el), ok = el >= mask;
            return (
              <g key={i} tabIndex={0} role="slider" aria-label={`G${i + 1}`} aria-valuetext={`${Math.round(az)}°, ${Math.round(el)}°`} onKeyDown={onKey(i)}
                onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(i); }} style={{ cursor: 'grab' }}>
                <circle cx={x} cy={y} r={11} style={{ fill: ok ? 'var(--primary)' : 'var(--surface)', stroke: ok ? 'var(--primary)' : 'var(--fg-3)' }} strokeWidth={1.5} strokeDasharray={ok ? undefined : '3 2'} />
                <text x={x} y={y + 3.5} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: ok ? 'var(--surface)' : 'var(--fg-3)', pointerEvents: 'none' }}>G{i + 1}</text>
              </g>
            );
          })}
        </svg>
        <svg viewBox={`0 0 ${E} ${E + 22}`} width={E} role="img" aria-label={T.ell} style={{ flex: '0 0 auto' }}>
          <text x={ec} y={12} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--fg-muted)' }}>{T.ell}</text>
          <g transform="translate(0,18)">
            <line x1={ec} x2={ec} y1={6} y2={E - 6} style={{ stroke: 'var(--border)' }} />
            <line x1={6} x2={E - 6} y1={ec} y2={ec} style={{ stroke: 'var(--border)' }} />
            <text x={ec + 3} y={14} style={{ fontSize: 9, fill: 'var(--fg-3)' }}>N</text>
            <text x={E - 12} y={ec - 3} style={{ fontSize: 9, fill: 'var(--fg-3)' }}>E</text>
            {ell && <ellipse cx={ec} cy={ec} rx={ell.major * uere * scale} ry={ell.minor * uere * scale} transform={`rotate(${ell.az - 90} ${ec} ${ec})`}
              style={{ fill: 'var(--accent)', stroke: 'var(--accent)' }} fillOpacity={0.2} strokeWidth={1.8} />}
            <line x1={10} x2={10 + scale * 2} y1={E - 8} y2={E - 8} style={{ stroke: 'var(--fg-muted)' }} strokeWidth={2} />
            <text x={10} y={E - 12} style={{ fontSize: 9, fill: 'var(--fg-muted)' }}>2 m</text>
          </g>
        </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={`${T.used}: ${used.length} / ${sats.length}`} rows={[
          ...(['gdop', 'pdop', 'hdop', 'vdop', 'tdop'] as const).map((k) => ({ k: k.toUpperCase(), v: q ? nf(q[k]) : T.none, tone: k === 'pdop' ? tone : undefined })),
          { k: T.q, v: T.cls[ci], tone },
          { k: T.sh, v: q ? `${nf(q.hdop * uere, 1)} m` : T.none, tone: 'accent' },
          { k: T.sv, v: q ? `${nf(q.vdop * uere, 1)} m` : T.none, tone: 'accent' },
          { k: `${T.ell}: ${T.axes}`, v: ell ? `${nf(ell.major * uere, 1)} m · ${T.dir} ${Math.round(ell.az)}°` : T.none, tone: 'muted' },
        ]} />
        <p className="muted" style={{ fontSize: '0.76rem', margin: '8px 0 0' }}>{T.drag}</p>
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={pick} options={(['open', 'canyon', 'corner'] as const).map((k) => ({ v: k, label: T[k] }))} />
        <Slider label={T.mask} value={mask} min={0} max={40} step={5} fmt={(v) => `${v}°`} onChange={setMask} />
        <Slider label={T.uere} value={uere} min={0.5} max={10} step={0.5} fmt={(v) => `${nf(v, 1)} m`} onChange={setUere} />
      </div>
    </div>
  );
}
