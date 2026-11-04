import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { band, quantize } from '../lib/raster';
import { bandLabel } from './bands';
import { useScene } from './cube';
import { rgbImage } from './draw';

const N = 512;
const DISPLAY: [number, number] = [0, 0.15]; // fixed so water detail is visible; shown under the image
// West Lake window used for the "grey levels inside the lake" count
const LAKE = { r0: 250, r1: 350, c0: 100, c1: 220 };

const TXT = {
  vi: { loading: 'Đang tải ảnh…', bits: 'Số bit lưu mỗi pixel', band: 'Kênh', levels: 'mức xám', step: 'Bước lượng tử (phản xạ)',
        all: 'Số mức khác nhau trong cả ảnh', lake: 'trong một ô giữa Hồ Tây', disp: 'Hiển thị: tuyến tính 0–0,15; lượng tử hóa trên dải phản xạ 0–1.',
        canvas: 'Ảnh sau khi lượng tử hóa' },
  en: { loading: 'Loading image…', bits: 'Bits stored per pixel', band: 'Band', levels: 'grey levels', step: 'Quantisation step (reflectance)',
        all: 'Distinct levels in the whole image', lake: 'in a window inside West Lake', disp: 'Display: linear 0–0.15; quantised over the 0–1 reflectance range.',
        canvas: 'Image after quantisation' },
};

export default function Quantization({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bits, setBits] = useState(6);
  const [b, setB] = useState('B3');

  const out = useMemo(() => {
    if (!scene) return null;
    const src = band(scene.cube, b);
    const q = Float32Array.from(src, (v) => quantize(v * scene.cube.scale, bits));
    const all = new Set(q).size;
    const lake = new Set<number>();
    for (let r = LAKE.r0; r < LAKE.r1; r++) for (let c = LAKE.c0; c < LAKE.c1; c++) lake.add(q[r * N + c]);
    return { q, all, lake: lake.size };
  }, [scene, b, bits]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !out) return;
    ctx.putImageData(rgbImage([out.q], [DISPLAY], N), 0, 0);
    ctx.strokeStyle = '#E69F00'; ctx.lineWidth = 2;
    ctx.strokeRect(LAKE.c0, LAKE.r0, LAKE.c1 - LAKE.c0, LAKE.r1 - LAKE.r0);
  }, [out]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !out) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="viz two">
      <canvas ref={canvas} width={N} height={N} role="img" aria-label={`${T.canvas}: ${b}, ${bits} bit`} />
      <div>
        <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label style={{ justifyContent: 'space-between' }}>{T.band}
            <select value={b} onChange={(e) => setB(e.target.value)}>
              {['B3', 'B4', 'B8', 'B11'].map((x) => <option key={x} value={x}>{bandLabel(x, lang)}</option>)}
            </select>
          </label>
          <label style={{ justifyContent: 'space-between' }}>{T.bits} <strong className="num">{bits} bit = {(2 ** bits).toLocaleString(loc)} {T.levels}</strong></label>
          <input type="range" min={2} max={12} step={1} value={bits} aria-label={T.bits} aria-valuetext={`${bits} bit`} onChange={(e) => setBits(Number(e.target.value))} />
        </div>
        <dl className="num" style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 12px', marginTop: 'var(--s4)' }}>
          <dt className="muted">{T.step}</dt><dd style={{ margin: 0 }}>{(1 / (2 ** bits - 1)).toLocaleString(loc, { maximumSignificantDigits: 3 })}</dd>
          <dt className="muted">{T.all}</dt><dd style={{ margin: 0 }}>{out.all.toLocaleString(loc)}</dd>
          <dt className="muted"><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #E69F00', marginRight: 6 }} />… {T.lake}</dt>
          <dd style={{ margin: 0 }}><strong>{out.lake}</strong></dd>
        </dl>
        <p className="muted" style={{ fontSize: '0.82rem' }}>{T.disp}</p>
      </div>
    </div>
  );
}
