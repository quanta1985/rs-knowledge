import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { band } from '../lib/raster';
import { S2 } from './bands';
import { useProduct, type RefPoint } from './cube';
import { Pills, StatPanel } from './VizUi';

const BANDS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;
const TXT = {
  vi: { band: 'Kênh', point: 'Điểm', meta: 'Metadata ảnh L1C', e: 'Bức xạ Mặt Trời E', th: 'Góc thiên đỉnh θs', u: 'U = 1/d²', off: 'RADIO_ADD_OFFSET',
        s1: 'Giá trị số (DN) trong tệp L1C gốc', s2: 'Phản xạ đỉnh khí quyển', s3: 'Bức xạ đo được tại vệ tinh', s4: 'Phản xạ mặt đất (L2A, sau hiệu chỉnh khí quyển)',
        s5: 'Phần do khí quyển', loading: 'Đang tải…', unitL: 'W·m⁻²·sr⁻¹·µm⁻¹' },
  en: { band: 'Band', point: 'Point', meta: 'L1C metadata', e: 'Solar irradiance E', th: 'Solar zenith θs', u: 'U = 1/d²', off: 'RADIO_ADD_OFFSET',
        s1: 'Digital number (DN) in the original L1C file', s2: 'Top-of-atmosphere reflectance', s3: 'Radiance measured at the satellite', s4: 'Surface reflectance (L2A, after atmospheric correction)',
        s5: 'Atmospheric part', loading: 'Loading…', unitL: 'W·m⁻²·sr⁻¹·µm⁻¹' },
};

const mean3 = (v: ArrayLike<number>, w: number, r: number, c: number) => {
  let s = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s += v[(r + dr) * w + c + dc];
  return s / 9;
};

/** Worked example: DN -> TOA reflectance -> at-sensor radiance, with the scene's own metadata. */
export default function RadianceCalc({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const toa = useProduct('ch07-toa'), sr = useProduct('hanoi-s2');
  const [ref, setRef] = useState<RefPoint[]>([]);
  const [refErr, setRefErr] = useState<string | null>(null);
  const [b, setB] = useState('B2');
  const [pid, setPid] = useState('west-lake');
  useEffect(() => {
    let alive = true;
    fetch(`${DATA}hanoi-s2/reference.json`).then((r) => { if (!r.ok) throw new Error(`${r.status} reference.json`); return r.json(); })
      .then((j: { points: RefPoint[] }) => alive && setRef(j.points), (e: unknown) => alive && setRefErr(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, []);
  const p = ref.find((x) => x.id === pid);
  const v = useMemo(() => {
    if (!toa.product || !sr.product || !p) return null;
    const c = toa.product.cube, s = sr.product.cube;
    return { dn: Math.round(mean3(band(c, b), c.width, p.row, p.col)), sr: mean3(band(s, b), s.width, p.row, p.col) * s.scale };
  }, [toa.product, sr.product, p, b]);

  const err = toa.error ?? sr.error ?? refErr;
  if (err) return <p className="viz status" role="alert">Error: {err}</p>;
  if (!v || !toa.product) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const sc = (toa.product.meta as unknown as { scene: Record<string, number> }).scene;
  const E = sc[`SOLAR_IRRADIANCE_${b}`], th = sc.MEAN_SOLAR_ZENITH_ANGLE, U = sc.REFLECTANCE_CONVERSION_CORRECTION, off = sc[`RADIO_ADD_OFFSET_${b}`];
  const rho = v.dn / 10000, L = (rho * U * E * Math.cos((th * Math.PI) / 180)) / Math.PI;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, k = 3) => x.toLocaleString(loc, { minimumFractionDigits: k, maximumFractionDigits: k, useGrouping: false });
  const step = (n: number, t: string, f: string, r: string) => (
    <li style={{ marginBottom: 12 }}>
      <span className="ctl-label">{n}. {t}</span>
      <div style={{ font: '0.9rem var(--font-mono)', color: '#e2e8f0', marginTop: 2 }}>{f} = <b style={{ color: '#4fc3cd' }}>{r}</b></div>
    </li>
  );

  return (
    <div className="dark-card">
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {step(1, T.s1, `${v.dn} − (${off})`, String(v.dn - off))}
        {step(2, T.s2, `ρ = (DN + offset) / 10 000 = (${v.dn - off} − 1000) / 10 000`, nf(rho, 4))}
        {step(3, T.s3, `L = ρ · U · E · cos θs / π = ${nf(rho, 4)} × ${nf(U, 4)} × ${nf(E, 2)} × cos ${nf(th, 2)}° / π`, `${nf(L, 2)} ${T.unitL}`)}
        {step(4, T.s4, 'ρ_SR', nf(v.sr, 4))}
        {step(5, T.s5, 'ρ_TOA − ρ_SR', `${nf(rho - v.sr, 4)} (${nf((100 * (rho - v.sr)) / rho, 0)} % ρ_TOA)`)}
      </ol>
      <div className="hud-static">
        <StatPanel title={`${T.meta} · ${b} (${Math.round(S2[b].c)} nm)`} rows={[
          { k: T.e, v: `${nf(E, 2)} W·m⁻²·µm⁻¹` }, { k: T.th, v: `${nf(th, 2)}°` }, { k: T.u, v: nf(U, 4) }, { k: T.off, v: String(off), tone: 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.band} value={b} onChange={setB} options={BANDS.map((x) => ({ v: x, label: x }))} />
        <Pills label={T.point} value={pid} onChange={setPid} options={ref.map((x) => ({ v: x.id, label: x.label[lang].split(/[,(/]/)[0] }))} />
      </div>
    </div>
  );
}
