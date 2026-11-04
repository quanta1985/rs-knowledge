import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { kmeans, minDistance, mulberry32 } from '../lib/classify';
import { CLASSES, FEATURES, featureMatrix, useCh9 } from './ch09';
import { frameQuad, useScene } from './cube';
import MapStage from './MapStage';
import { Key, Slider, StatPanel } from './VizUi';

// Okabe-Ito order plus grey: up to 8 clusters, all distinguishable.
const PAL = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'];
const SUB = 20000; // pixels used to fit the centres; every pixel is then assigned to the nearest centre

const TXT = {
  vi: { loading: 'Đang tải ảnh…', k: 'Số cụm k', seed: 'Khởi tạo lại', op: 'Độ mờ', title: 'k-means (6 kênh)', share: 'diện tích',
        dom: 'lớp WorldCover chiếm nhiều nhất', label: 'Bản đồ cụm k-means khu Hồ Tây – sông Hồng', run: 'Lần chạy' },
  en: { loading: 'Loading image…', k: 'Clusters k', seed: 'Restart', op: 'Opacity', title: 'k-means (6 bands)', share: 'area',
        dom: 'most frequent WorldCover class', label: 'k-means cluster map, West Lake – Red River', run: 'Run' },
};

export default function KMeansLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const { data } = useCh9();
  const [k, setK] = useState(5);
  const [seed, setSeed] = useState(1);
  const [op, setOp] = useState(0.8);

  const X = useMemo(() => scene && featureMatrix(scene.cube), [scene]);
  const quad = useMemo(() => scene && frameQuad(scene.meta), [scene]);
  const run = useMemo(() => {
    if (!X || !scene) return null;
    const d = FEATURES.length, n = scene.cube.width * scene.cube.height, rnd = mulberry32(1000 + seed);
    const sub = new Float32Array(SUB * d);
    for (let i = 0; i < SUB; i++) { const j = Math.floor(rnd() * n); sub.set(X.subarray(j * d, (j + 1) * d), i * d); }
    const { centers } = kmeans(sub, SUB, d, k, 30, seed);
    const labels = new Uint8Array(n);
    for (let i = 0; i < n; i++) labels[i] = minDistance(centers, X.subarray(i * d, (i + 1) * d));
    return { labels, centers };
  }, [X, scene, k, seed]);

  const image = useMemo(() => {
    if (!run || !scene) return null;
    const img = new ImageData(scene.cube.width, scene.cube.height);
    const rgb = PAL.map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
    run.labels.forEach((l, i) => img.data.set([...rgb[l], 255], i * 4));
    return img;
  }, [run, scene]);
  const overlays = useMemo(() => [{ id: 'km', image, opacity: op }], [image, op]);

  const table = useMemo(() => {
    if (!run) return null;
    const cnt = new Array<number>(k).fill(0), cross = Array.from({ length: k }, () => new Array<number>(CLASSES.length).fill(0));
    run.labels.forEach((l, i) => { cnt[l]++; const r = data?.reference[i]; if (r != null && r < CLASSES.length) cross[l][r]++; });
    return run.centers.map((c, j) => {
      const ndvi = (c[3] - c[2]) / (c[3] + c[2]), dom = cross[j].indexOf(Math.max(...cross[j]));
      const tot = cross[j].reduce((a, b) => a + b, 0);
      return { j, share: cnt[j] / run.labels.length, ndvi, dom, domShare: tot ? cross[j][dom] / tot : 0 };
    });
  }, [run, data, k]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !table || !quad) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hud = (
    <StatPanel title={`${T.title} · ${T.run} ${seed}`} rows={table.map((t) => ({
      k: <Key color={PAL[t.j]}>{`#${t.j + 1} · ${nf(t.share * 100, 0)} %`}</Key>,
      v: <span style={{ whiteSpace: 'nowrap' }}>{`NDVI ${nf(t.ndvi)} · ${data ? `${CLASSES[t.dom][lang]} ${nf(t.domShare * 100, 0)} %` : '…'}`}</span>,
    }))}>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.share} · NDVI {lang === 'vi' ? 'của tâm cụm' : 'of the centre'} · {T.dom}</p>
    </StatPanel>
  );
  const bar = <>
    <Slider label={T.k} value={k} min={2} max={8} onChange={setK} />
    <button type="button" className="pill-btn" onClick={() => setSeed((s) => s + 1)}>{T.seed}</button>
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;
  return <MapStage lang={lang} label={T.label} quad={quad} overlays={overlays} hud={hud} bar={bar} height={600} />;
}
