import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel, utmToLonLat } from '../lib/geo';
import { CLASSES, K, PIXEL_KM2, classCounts, classImage, classifyAll, featureMatrix, useCh9, type Method, type Sample } from './ch09';
import { frameQuad, useScene } from './cube';
import { composite } from './draw';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type View = 'rgb' | 'map' | 'ref';

const TXT = {
  vi: { loading: 'Đang tải ảnh…', cls: 'Lớp khi bấm', method: 'Bộ phân loại', md: 'Khoảng cách nhỏ nhất', ml: 'Hợp lý cực đại', view: 'Lớp',
        rgb: 'Ảnh S2', map: 'Kết quả', ref: 'WorldCover', op: 'Độ mờ', preset: 'Mẫu gợi ý', clear: 'Xoá mẫu', undo: 'Hoàn tác',
        title: 'Phân loại có giám sát', samples: 'Mẫu (điểm × 9 px)', agree: 'Trùng WorldCover', need: 'Cần mẫu của ít nhất 2 lớp',
        hint: 'Bấm lên bản đồ để thêm mẫu cho lớp đang chọn', label: 'Bản đồ phân loại lớp phủ Hồ Tây – sông Hồng' },
  en: { loading: 'Loading image…', cls: 'Class on click', method: 'Classifier', md: 'Minimum distance', ml: 'Maximum likelihood', view: 'Layer',
        rgb: 'S2 image', map: 'Result', ref: 'WorldCover', op: 'Opacity', preset: 'Suggested samples', clear: 'Clear', undo: 'Undo',
        title: 'Supervised classification', samples: 'Samples (points × 9 px)', agree: 'Agrees with WorldCover', need: 'Needs samples of at least 2 classes',
        hint: 'Click the map to add a sample of the selected class', label: 'Land-cover classification map, West Lake – Red River' },
};

export default function ClassifyLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const { data, error: err2 } = useCh9();
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [active, setActive] = useState(0);
  const [method, setMethod] = useState<Method>('ml');
  const [view, setView] = useState<View>('map');
  const [op, setOp] = useState(0.8);

  const pts = samples ?? data?.training ?? [];
  const X = useMemo(() => scene && featureMatrix(scene.cube), [scene]);
  const rgb = useMemo(() => scene && composite(scene.cube, ['B4', 'B3', 'B2'], 'p2-98').img, [scene]);
  const result = useMemo(() => (X && scene ? classifyAll(X, scene.cube.width, scene.cube.height, pts, method) : null), [X, scene, pts, method]);
  const stats = useMemo(() => {
    if (!result || !data) return null;
    let same = 0;
    for (let i = 0; i < result.length; i++) if (result[i] === data.reference[i]) same++;
    return { counts: classCounts(result), agree: same / result.length };
  }, [result, data]);
  const image = useMemo(() => {
    if (!scene) return null;
    const { width: w, height: h } = scene.cube;
    if (view === 'rgb') return rgb;
    if (view === 'ref') return data ? classImage(data.reference, w, h) : null;
    return result ? classImage(result, w, h) : rgb;
  }, [scene, view, rgb, result, data]);
  const overlays = useMemo(() => [{ id: 'cls', image, opacity: view === 'rgb' ? 1 : op }], [image, op, view]);

  const quad = useMemo(() => scene && frameQuad(scene.meta), [scene]);
  const markers = useMemo(() => {
    if (!scene) return [];
    const [x0, y1] = scene.meta.origin_xy ?? [0, 0];
    return pts.map((p, i) => {
      const [lon, lat] = utmToLonLat(x0 + (p.col + 0.5) * 10, y1 - (p.row + 0.5) * 10, 48);
      return { id: `s${i}`, lon, lat, label: '', color: CLASSES[p.cls].color };
    });
  }, [scene, pts]);

  if (error || err2) return <p className="viz status" role="alert">Error: {error ?? err2}</p>;
  if (!scene || !quad || !data) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const per = CLASSES.map((_, k) => pts.filter((p) => p.cls === k).length);

  const hud = (
    <StatPanel title={`${T.title} · ${method === 'ml' ? T.ml : T.md}`} rows={[
      ...CLASSES.map((c, k) => ({
        k: <Key color={c.color}>{c[lang]}</Key>,
        v: `${per[k]} · ${stats ? `${nf(stats.counts[k] * PIXEL_KM2)} km²` : '—'}`,
        tone: per[k] ? undefined : ('muted' as const),
      })),
      { k: T.agree, v: stats ? `${nf(stats.agree * 100, 1)} %` : T.need, tone: 'accent' },
    ]}>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.samples} · km² · {T.hint}.</p>
    </StatPanel>
  );
  const bar = <>
    <div style={{ maxWidth: '100%', minWidth: 0 }}>{/* lets the 5 class pills wrap on phones */}
      <Pills label={T.cls} value={String(active)} onChange={(v) => setActive(Number(v))}
        options={CLASSES.map((c, k) => ({ v: String(k), label: <Key color={c.color}>{c[lang]}</Key> }))} />
    </div>
    <Pills label={T.method} value={method} onChange={setMethod} options={[{ v: 'md', label: T.md }, { v: 'ml', label: T.ml }]} />
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'rgb', label: T.rgb }, { v: 'map', label: T.map }, { v: 'ref', label: T.ref }]} />
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
    <div className="ctl"><span className="ctl-label">{T.samples}</span><div className="pills">
      <button type="button" onClick={() => setSamples(data.training)}>{T.preset}</button>
      <button type="button" onClick={() => setSamples(pts.slice(0, -1))} disabled={!pts.length}>{T.undo}</button>
      <button type="button" onClick={() => setSamples([])}>{T.clear}</button>
    </div></div>
  </>;

  return (
    <>
      <MapStage lang={lang} label={T.label} quad={quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={640}
        onClick={(p) => {
          const px = lonLatToPixel(quad, p.lon, p.lat, scene.cube.width, scene.cube.height);
          if (px) setSamples([...pts, { cls: active, ...px }]);
        }} />
      <details>
        <summary>{lang === 'vi' ? 'Bảng diện tích' : 'Area table'}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{lang === 'vi' ? 'Lớp' : 'Class'}</th><th>{lang === 'vi' ? 'Số điểm mẫu' : 'Sample points'}</th><th>{lang === 'vi' ? 'Kết quả (km²)' : 'Result (km²)'}</th><th>WorldCover (km²)</th></tr></thead>
          <tbody>{CLASSES.map((c, k) => <tr key={c.id}><td>{c[lang]}</td><td>{per[k]}</td><td>{stats ? nf(stats.counts[k] * PIXEL_KM2) : '—'}</td><td>{nf(classCounts(data.reference)[k] * PIXEL_KM2)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>
  );
}
