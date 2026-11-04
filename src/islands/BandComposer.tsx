import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bandLabel } from './bands';
import { frameQuad, useScene } from './cube';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';
import { composite, type StretchMode } from './draw';

type RGB = [string, string, string];
const PRESETS: { id: string; rgb: RGB; name: Record<Lang, string>; read: Record<Lang, string> }[] = [
  { id: 'tc', rgb: ['B4', 'B3', 'B2'], name: { vi: 'Màu thật', en: 'True colour' },
    read: { vi: 'Giống mắt người nhìn. Nước sông Hồng sáng và xanh-lục hơn Hồ Tây; cây xanh sẫm, khó tách khỏi bóng nhà.',
            en: 'What the eye sees. The Red River is brighter and greener than West Lake; trees are dark and hard to separate from shadows.' } },
  { id: 'cir', rgb: ['B8', 'B4', 'B3'], name: { vi: 'Hồng ngoại giả', en: 'False-colour infrared' },
    read: { vi: 'Thực vật đỏ tươi vì phản xạ NIR mạnh (gán vào kênh Đỏ). Nước gần như đen; đô thị xanh-xám.',
            en: 'Vegetation is bright red because its strong NIR reflectance drives the red gun. Water is near-black; built-up is blue-grey.' } },
  { id: 'swir', rgb: ['B12', 'B8A', 'B4'], name: { vi: 'SWIR giả màu', en: 'SWIR false colour' },
    read: { vi: 'Thực vật xanh lá; đất trống và vùng xây dựng nâu-hồng; nước đen vì SWIR bị nước hấp thụ rất mạnh.',
            en: 'Vegetation green; bare soil and built-up land brown-pink; water black because SWIR is strongly absorbed by water.' } },
  { id: 'agri', rgb: ['B11', 'B8', 'B2'], name: { vi: 'Nông nghiệp', en: 'Agriculture' },
    read: { vi: 'Cây trồng khỏe xanh lá sáng; đất trống nâu đỏ. Hay dùng để theo dõi mùa vụ.',
            en: 'Healthy crops bright green; bare fields reddish brown. Common for crop monitoring.' } },
];

const TXT = {
  vi: { loading: 'Đang tải ảnh…', preset: 'Tổ hợp mẫu', custom: 'Tự chọn', r: 'Đỏ', g: 'Lục', b: 'Lam', stretch: 'Kéo giãn',
        p298: '2–98 %', fixed: '0–0,3', none: '0–1', lim: 'Giới hạn hiển thị (phản xạ)', op: 'Độ mờ', read: 'Cách đọc',
        label: 'Bản đồ tổ hợp màu Sentinel-2, Hà Nội' },
  en: { loading: 'Loading image…', preset: 'Preset', custom: 'Custom', r: 'Red', g: 'Green', b: 'Blue', stretch: 'Stretch',
        p298: '2–98 %', fixed: '0–0.3', none: '0–1', lim: 'Display limits (reflectance)', op: 'Opacity', read: 'How to read',
        label: 'Sentinel-2 colour composite map, Hanoi' },
};
const GUN = ['#e5484d', '#30a46c', '#3e63dd'];

export default function BandComposer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [rgb, setRgb] = useState<RGB>(['B8', 'B4', 'B3']);
  const [mode, setMode] = useState<StretchMode>('p2-98');
  const [op, setOp] = useState(1);
  const out = useMemo(() => scene && composite(scene.cube, rgb, mode), [scene, rgb, mode]);
  const overlays = useMemo(() => [{ id: 'rgb', image: out?.img ?? null, opacity: op }], [out, op]);
  const quad = useMemo(() => scene && frameQuad(scene.meta), [scene]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !out || !quad) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const preset = PRESETS.find((p) => p.rgb.join() === rgb.join());
  const nf = (v: number) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 3 });
  const setGun = (i: number, b: string) => setRgb((c) => c.map((x, j) => (j === i ? b : x)) as RGB);

  const hud = (
    <StatPanel title={`${preset ? preset.name[lang] : T.custom} · R ${rgb[0]} G ${rgb[1]} B ${rgb[2]}`}
      rows={out.limits.map((l, i) => ({ k: <span><i aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 6, background: GUN[i] }} />{[T.r, T.g, T.b][i]} ({rgb[i]})</span>,
        v: `${nf(l.lo)}–${nf(l.hi)}`, tone: 'accent' as const }))}>
      {preset && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}><b style={{ color: '#4fc3cd' }}>{T.read}:</b> {preset.read[lang]}</p>}
      <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>{T.lim}</p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.preset} value={preset?.id ?? ''} onChange={(id) => setRgb(PRESETS.find((p) => p.id === id)!.rgb)} options={PRESETS.map((p) => ({ v: p.id, label: p.name[lang] }))} />
    {[T.r, T.g, T.b].map((gun, i) => (
      <label key={gun} className="ctl"><span className="ctl-label" style={{ color: GUN[i] }}>{gun}</span>
        <select className="stage-select" value={rgb[i]} onChange={(e) => setGun(i, e.target.value)}>
          {scene.cube.bands.map((b) => <option key={b} value={b}>{bandLabel(b, lang)}</option>)}
        </select>
      </label>
    ))}
    <Pills label={T.stretch} value={mode} onChange={setMode} options={[{ v: 'p2-98', label: T.p298 }, { v: 'fixed-0.3', label: T.fixed }, { v: 'none', label: T.none }]} />
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;

  return <MapStage lang={lang} label={`${T.label}: R=${rgb[0]}, G=${rgb[1]}, B=${rgb[2]}`} quad={quad} overlays={overlays} hud={hud} bar={bar} height={620} />;
}
