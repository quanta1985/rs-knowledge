import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bandLabel } from './bands';
import { useScene } from './cube';
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
        p298: '2–98 % mỗi kênh', fixed: 'Cố định 0–0,3', none: 'Không kéo giãn (0–1)', lim: 'Giới hạn hiển thị (phản xạ)',
        canvas: 'Ảnh tổ hợp màu Sentinel-2, Hà Nội' },
  en: { loading: 'Loading image…', preset: 'Preset', custom: 'Custom', r: 'Red', g: 'Green', b: 'Blue', stretch: 'Stretch',
        p298: '2–98 % per band', fixed: 'Fixed 0–0.3', none: 'No stretch (0–1)', lim: 'Display limits (reflectance)',
        canvas: 'Sentinel-2 colour composite, Hanoi' },
};

export default function BandComposer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rgb, setRgb] = useState<RGB>(['B8', 'B4', 'B3']);
  const [mode, setMode] = useState<StretchMode>('p2-98');
  const out = useMemo(() => scene && composite(scene.cube, rgb, mode), [scene, rgb, mode]);

  useEffect(() => { if (out) canvas.current?.getContext('2d')?.putImageData(out.img, 0, 0); }, [out]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !out) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const preset = PRESETS.find((p) => p.rgb.join() === rgb.join());
  const nf = (v: number) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 3 });
  const setGun = (i: number, b: string) => setRgb((c) => c.map((x, j) => (j === i ? b : x)) as RGB);

  return (
    <div className="viz two">
      <canvas ref={canvas} width={scene.cube.width} height={scene.cube.height}
        aria-label={`${T.canvas}: R=${rgb[0]}, G=${rgb[1]}, B=${rgb[2]}`} role="img" />
      <div>
        <div className="seg" role="group" aria-label={T.preset} style={{ flexWrap: 'wrap', marginBottom: 'var(--s3)' }}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={preset?.id === p.id} onClick={() => setRgb(p.rgb)}>{p.name[lang]}</button>
          ))}
        </div>
        <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {[T.r, T.g, T.b].map((gun, i) => (
            <label key={gun} style={{ justifyContent: 'space-between' }}>
              <span><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 6, background: ['#e5484d', '#30a46c', '#3e63dd'][i] }} />{gun}</span>
              <select value={rgb[i]} onChange={(e) => setGun(i, e.target.value)}>
                {scene.cube.bands.map((b) => <option key={b} value={b}>{bandLabel(b, lang)}</option>)}
              </select>
            </label>
          ))}
          <label style={{ justifyContent: 'space-between' }}>{T.stretch}
            <select value={mode} onChange={(e) => setMode(e.target.value as StretchMode)}>
              <option value="p2-98">{T.p298}</option><option value="fixed-0.3">{T.fixed}</option><option value="none">{T.none}</option>
            </select>
          </label>
        </div>
        <p style={{ marginTop: 'var(--s3)' }}><strong>{preset ? preset.name[lang] : T.custom}</strong>{preset && <> — {preset.read[lang]}</>}</p>
        <p className="readout num">{T.lim}: {out.limits.map((l, i) => `${['R', 'G', 'B'][i]} ${nf(l.lo)}–${nf(l.hi)}`).join(' · ')}</p>
      </div>
    </div>
  );
}
