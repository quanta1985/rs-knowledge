import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { mix, ndviSignFlip } from '../lib/raster';
import { CLASS_STYLE, S2 } from './bands';
import { useScene } from './cube';
import LineChart, { Legend, type Series } from './LineChart';

const TXT = {
  vi: { loading: 'Đang tải phổ mẫu…', a: 'Thành phần 1', b: 'Thành phần 2', f: 'Tỷ lệ thành phần 1 trong pixel', title: 'Phổ pixel hỗn hợp',
        x: 'Bước sóng (nm)', y: 'Phản xạ', mixed: 'Pixel hỗn hợp', ndviMix: 'NDVI của pixel hỗn hợp', ndviAvg: 'Trung bình NDVI hai thành phần',
        above: (p: string) => `NDVI chỉ âm khi thành phần 1 chiếm hơn ${p} pixel.`,
        below: (p: string) => `NDVI chỉ âm khi thành phần 1 chiếm dưới ${p} pixel.`,
        never: 'Với cặp này, NDVI không bao giờ âm.', always: 'Với cặp này, NDVI luôn âm.' },
  en: { loading: 'Loading reference spectra…', a: 'Component 1', b: 'Component 2', f: 'Share of component 1 in the pixel', title: 'Mixed-pixel spectrum',
        x: 'Wavelength (nm)', y: 'Reflectance', mixed: 'Mixed pixel', ndviMix: 'NDVI of the mixed pixel', ndviAvg: 'Mean of the two NDVIs',
        above: (p: string) => `NDVI turns negative only when component 1 exceeds ${p} of the pixel.`,
        below: (p: string) => `NDVI is negative only while component 1 stays below ${p} of the pixel.`,
        never: 'For this pair NDVI is never negative.', always: 'For this pair NDVI is always negative.' },
};

export default function MixedPixel({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [aId, setA] = useState('west-lake');
  const [bId, setB] = useState('crops');
  const [f, setF] = useState(0.5);
  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const { ref, cube } = scene;
  const A = ref.find((p) => p.id === aId)!;
  const B = ref.find((p) => p.id === bId)!;
  const wl = cube.bands.map((b) => S2[b].c);
  const iR = cube.bands.indexOf('B4'), iN = cube.bands.indexOf('B8');
  const m = mix(A.mean, B.mean, f);
  const nd = (s: number[]) => (s[iN] - s[iR]) / (s[iN] + s[iR]);
  const flip = ndviSignFlip(A.mean[iR], A.mean[iN], B.mean[iR], B.mean[iN]);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v: number) => `${(v * 100).toLocaleString(loc, { maximumFractionDigits: 1 })} %`;
  const opts = (sel: string, set: (v: string) => void, label: string) => (
    <label style={{ justifyContent: 'space-between' }}>{label}
      <select value={sel} onChange={(e) => set(e.target.value)}>{ref.map((p) => <option key={p.id} value={p.id}>{p.label[lang]}</option>)}</select>
    </label>
  );
  const ca = CLASS_STYLE[aId].color, cb = CLASS_STYLE[bId].color;
  // mixed line first so the thinner pure spectra draw on top of it
  const series: Series[] = [
    { id: 'm', label: T.mixed, color: 'currentColor', width: 3.5, marker: 'circle', points: wl.map((x, i) => [x, m[i]]) },
    { id: 'a', label: A.label[lang], color: ca, dash: '5 4', marker: CLASS_STYLE[aId].marker, width: 1.5, points: wl.map((x, i) => [x, A.mean[i]]) },
    { id: 'b', label: B.label[lang], color: cb, dash: '2 3', marker: CLASS_STYLE[bId].marker, width: 1.5, points: wl.map((x, i) => [x, B.mean[i]]) },
  ];

  return (
    <div className="viz two">
      <div>
        <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {opts(aId, setA, T.a)}
          {opts(bId, setB, T.b)}
          <label style={{ justifyContent: 'space-between' }}>{T.f} <strong className="num">{pct(f)}</strong></label>
          <input type="range" min={0} max={1} step={0.01} value={f} aria-label={T.f} aria-valuetext={pct(f)} onChange={(e) => setF(Number(e.target.value))} />
        </div>
        {/* a 10 m pixel drawn as a square split by area share */}
        <div aria-hidden="true" style={{ display: 'flex', width: 120, height: 120, margin: 'var(--s4) auto', border: '2px solid var(--fg)' }}>
          <div style={{ width: `${f * 100}%`, background: ca }} />
          <div style={{ flex: 1, background: cb, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 4px, transparent 4px 9px)' }} />
        </div>
        <p className="num" style={{ margin: 0 }}>{T.ndviMix}: <strong>{nf(nd(m))}</strong></p>
        <p className="num muted" style={{ margin: 0 }}>{T.ndviAvg}: {nf(f * nd(A.mean) + (1 - f) * nd(B.mean))}</p>
        <p style={{ fontSize: '0.92rem' }}>{flip.dir === 'above' || flip.dir === 'below' ? T[flip.dir](pct(flip.f)) : T[flip.dir]}</p>
      </div>
      <div>
        <LineChart title={T.title} x={[400, 2300]} y={[0, 0.5]} xLabel={T.x} yLabel={T.y} height={300}
          xTicks={[500, 1000, 1500, 2000]} yFormat={(v) => nf(v, 1)} series={series} />
        <Legend items={series} />
      </div>
    </div>
  );
}
