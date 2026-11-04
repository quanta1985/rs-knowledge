import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { CLASS_STYLE, S2 } from './bands';
import { useScene } from './cube';
import LineChart, { Legend } from './LineChart';

// Simulated by keeping a subset of the Sentinel-2 bands (closest equivalents).
const SETS: { id: string; bands: string[]; name: Record<Lang, string> }[] = [
  { id: 'rgb', bands: ['B2', 'B3', 'B4'], name: { vi: 'Máy ảnh RGB (3 kênh)', en: 'RGB camera (3 bands)' } },
  { id: 'oli', bands: ['B2', 'B3', 'B4', 'B8A', 'B11', 'B12'], name: { vi: 'Kiểu Landsat OLI (6 kênh)', en: 'Landsat OLI-like (6 bands)' } },
  { id: 'msi', bands: ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'], name: { vi: 'Sentinel-2 MSI (10 kênh)', en: 'Sentinel-2 MSI (10 bands)' } },
];

const TXT = {
  vi: { loading: 'Đang tải phổ mẫu…', sensor: 'Cảm biến', title: 'Phổ mẫu nhìn qua các bộ kênh khác nhau', x: 'Bước sóng (nm)', y: 'Phản xạ',
        pair: 'So sánh hai lớp', dist: 'Khoảng cách phổ (Euclid, trên các kênh đang có)' },
  en: { loading: 'Loading reference spectra…', sensor: 'Sensor', title: 'Reference spectra seen through different band sets', x: 'Wavelength (nm)', y: 'Reflectance',
        pair: 'Compare two classes', dist: 'Spectral distance (Euclidean, over available bands)' },
};

export default function SpectralSampling({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [set, setSet] = useState('rgb');
  const [p1, setP1] = useState('trees');
  const [p2, setP2] = useState('west-lake');
  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const { ref, cube } = scene;
  const bands = SETS.find((s) => s.id === set)!.bands;
  const idx = bands.map((b) => cube.bands.indexOf(b));
  const spec = (id: string) => ref.find((p) => p.id === id)!.mean;
  const pts = (id: string) => idx.map((i, k) => [S2[bands[k]].c, spec(id)[i]] as [number, number]);
  const distOver = (bs: string[]) => Math.sqrt(bs.reduce((acc, b) => {
    const i = cube.bands.indexOf(b);
    return acc + (spec(p1)[i] - spec(p2)[i]) ** 2;
  }, 0));
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 3) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const sel = (v: string, set2: (x: string) => void, k: number) => (
    <select value={v} onChange={(e) => set2(e.target.value)} aria-label={`${T.pair} ${k}`}>{ref.map((p) => <option key={p.id} value={p.id}>{p.label[lang]}</option>)}</select>
  );

  return (
    <div className="viz">
      <div className="seg" role="group" aria-label={T.sensor} style={{ flexWrap: 'wrap', width: 'fit-content' }}>
        {SETS.map((s) => <button key={s.id} type="button" aria-pressed={set === s.id} onClick={() => setSet(s.id)}>{s.name[lang]}</button>)}
      </div>
      <LineChart title={T.title} x={[400, 2300]} y={[0, 0.5]} xLabel={T.x} yLabel={T.y} height={300} xTicks={[500, 1000, 1500, 2000]}
        yFormat={(v) => nf(v, 1)}
        spans={bands.map((b, i) => ({ x0: S2[b].c - S2[b].w / 2, x1: S2[b].c + S2[b].w / 2, label: b.replace('B', ''), row: i % 2 }))}
        series={ref.map((p) => ({ id: p.id, label: p.label[lang], color: CLASS_STYLE[p.id].color, dash: CLASS_STYLE[p.id].dash,
          marker: CLASS_STYLE[p.id].marker, width: [p1, p2].includes(p.id) ? 3 : 1.2, points: pts(p.id) }))} />
      <Legend items={ref.map((p) => ({ id: p.id, label: p.label[lang], color: CLASS_STYLE[p.id].color, dash: CLASS_STYLE[p.id].dash, marker: CLASS_STYLE[p.id].marker }))} />
      <p className="controls">
        {T.pair}: {sel(p1, setP1, 1)} ↔ {sel(p2, setP2, 2)}
      </p>
      <p className="num" style={{ margin: 0 }}>{T.dist}: <strong>{nf(distOver(bands))}</strong>
        <span className="muted"> ({SETS.map((s) => `${s.bands.length}: ${nf(distOver(s.bands))}`).join(' · ')})</span>
      </p>
    </div>
  );
}
