import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { S2 } from './bands';
import { compose, pixel, PRESETS, SCENES, useCh08Scene } from './ch08scenes';
import MapStage from './MapStage';
import { Pills, StatPanel } from './VizUi';

const BANDS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
const TXT = {
  vi: { loading: 'Đang tải cảnh…', scene: 'Cảnh', preset: 'Tổ hợp', custom: 'Tự chọn', r: 'Đỏ', g: 'Lục', b: 'Lam', date: 'Ngày chụp',
        stretch: 'Kéo giãn 2–98 %', at: 'Phổ tại con trỏ', label: 'Bản đồ tổ hợp màu Sentinel-2', hover: 'Di chuột lên bản đồ' },
  en: { loading: 'Loading scene…', scene: 'Scene', preset: 'Composite', custom: 'Custom', r: 'Red', g: 'Green', b: 'Blue', date: 'Date',
        stretch: '2–98 % stretch', at: 'Spectrum under pointer', label: 'Sentinel-2 colour composite map', hover: 'Hover the map' },
};

export default function CompositeExplorer({ lang, initial = 'camau' }: { lang: Lang; initial?: string }) {
  const T = TXT[lang];
  const [sid, setSid] = useState(initial);
  const { scene, error } = useCh08Scene(sid);
  const [rgb, setRgb] = useState<[string, string, string]>(['B8', 'B4', 'B3']);
  const [hover, setHover] = useState<number | null>(null);
  const comp = useMemo(() => scene && compose(scene, rgb), [scene, rgb]);
  const overlays = useMemo(() => [{ id: 'comp', image: comp?.img ?? null }], [comp]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !comp) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, k = 2) => v.toLocaleString(loc, { minimumFractionDigits: k, maximumFractionDigits: k });
  const preset = PRESETS.find((p) => p.rgb.join() === rgb.join());
  const spec = hover == null ? null : pixel(scene, hover);
  const CW = 260, CH = 84, bw = CW / BANDS.length;
  const sel = (i: 0 | 1 | 2, label: string) => (
    <label className="ctl">
      <span className="ctl-label">{label}</span>
      <select value={rgb[i]} aria-label={label} onChange={(e) => setRgb((o) => o.map((x, k) => (k === i ? e.target.value : x)) as [string, string, string])}
        style={{ minHeight: 32, background: '#0d1424', color: '#e2e8f0', border: '1px solid rgba(148,163,184,.3)', borderRadius: 8 }}>
        {BANDS.filter((b) => scene.bands[b]).map((b) => <option key={b} value={b}>{b} · {S2[b].name[lang]}</option>)}
      </select>
    </label>
  );

  const hud = (
    <StatPanel title={`${SCENES.find((s) => s.id === sid)?.name[lang]} · ${preset ? preset.name[lang] : `${T.custom} ${rgb.join('-')}`}`} rows={[
      { k: T.date, v: scene.date },
      { k: 'RGB', v: rgb.join(' · '), tone: 'accent' },
      ...rgb.map((b, i) => ({ k: `${T.stretch} ${['R', 'G', 'B'][i]}`, v: `${nf(comp.lims[i][0], 3)}–${nf(comp.lims[i][1], 3)}`, tone: 'muted' as const })),
    ]}>
      {preset && <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.75rem' }}>{preset.use[lang]}</p>}
      <p className="stat-title" style={{ marginTop: 10 }}>{T.at}</p>
      <svg className="hist" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={spec ? BANDS.map((b) => `${b} ${nf(spec[b] ?? 0)}`).join(', ') : T.hover}>
        {BANDS.map((b, i) => {
          const v = spec?.[b] ?? 0, h = Math.min(1, v / 0.5) * (CH - 26), on = rgb.includes(b);
          return <g key={b}>
            <rect x={i * bw + 5} width={bw - 10} y={CH - 26 - h} height={h} fill={on ? '#4fc3cd' : '#94a3b8'} opacity={on ? 1 : 0.5} />
            <text x={i * bw + bw / 2} y={CH - 14} textAnchor="middle">{b}</text>
            <text x={i * bw + bw / 2} y={CH - 3} textAnchor="middle">{spec ? nf(v) : ''}</text>
          </g>;
        })}
      </svg>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.scene} value={sid} onChange={setSid} options={SCENES.filter((s) => s.id !== 'hanoi').map((s) => ({ v: s.id, label: s.name[lang] }))} />
    <Pills label={T.preset} value={preset?.id ?? ''} onChange={(id) => setRgb(PRESETS.find((p) => p.id === id)!.rgb)}
      options={PRESETS.map((p) => ({ v: p.id, label: p.rgb.map((b) => b.slice(1)).join('-') }))} />
    {sel(0, T.r)}{sel(1, T.g)}{sel(2, T.b)}
  </>;

  return (
    <MapStage key={scene.date} lang={lang} label={`${T.label}: ${SCENES.find((s) => s.id === sid)?.name[lang]}`} quad={scene.quad} overlays={overlays} hud={hud} bar={bar} height={640}
      onHover={(q) => { const px = q && lonLatToPixel(scene.quad, q.lon, q.lat, scene.w, scene.w); setHover(px ? px.row * scene.w + px.col : null); }} />
  );
}
