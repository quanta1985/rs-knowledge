import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Pills, StatPanel } from './VizUi';

type Step = { js: string; py: string; node: string; computed: boolean };
const STEPS: Step[] = [
  { js: "var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')", py: "col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')", node: 'ImageCollection.load', computed: false },
  { js: "  .filterBounds(frame).filterDate('2024-01-01', '2025-01-01');", py: "col = col.filterBounds(frame).filterDate('2024-01-01', '2025-01-01')", node: 'Collection.filter', computed: false },
  { js: "var ndvi = col.map(function (img) { return img.normalizedDifference(['B8', 'B4']); });", py: "ndvi = col.map(lambda img: img.normalizedDifference(['B8', 'B4']))", node: 'Collection.map(NDVI)', computed: false },
  { js: 'var med = ndvi.median();', py: 'med = ndvi.median()', node: 'Collection.reduce(median)', computed: false },
  { js: "Map.addLayer(med, {min: -1, max: 1}, 'NDVI');", py: "url = med.getMapId({'min': -1, 'max': 1})['tile_fetcher'].url_format", node: 'tiles → server', computed: true },
];

const TXT = {
  vi: { title: 'Earth Engine · tính lười', step: 'Bước', lang: 'Ngôn ngữ', next: 'Bước tiếp', reset: 'Làm lại', browser: 'Trong trình duyệt', sent: 'Đã gửi yêu cầu?',
        pix: 'Pixel đã tính', none: '0 (chỉ là mô tả)', tiles: 'chỉ các ô 256 × 256 đang hiện trên bản đồ', graph: 'Biểu thức (đồ thị) đang được dựng',
        no: 'Chưa', yes: 'Có', obj: (k: number) => `${k} đối tượng mô tả, chưa có dữ liệu`, fig: 'Sơ đồ đánh giá lười của Earth Engine' },
  en: { title: 'Earth Engine · lazy evaluation', step: 'Step', lang: 'Language', next: 'Next step', reset: 'Reset', browser: 'In the browser', sent: 'Request sent?',
        pix: 'Pixels computed', none: '0 (only a description)', tiles: 'only the 256 × 256 tiles visible on the map', graph: 'Expression (graph) being built',
        no: 'No', yes: 'Yes', obj: (k: number) => `${k} description objects, no data yet`, fig: 'Diagram of Earth Engine lazy evaluation' },
};

export default function LazyGraph({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [k, setK] = useState(1);
  const [code, setCode] = useState<'js' | 'py'>('js');
  const done = STEPS.slice(0, k), computed = done.some((s) => s.computed);
  const W = 640, BH = 34, GAP = 14;
  return (
    <div className="dark-card">
      <div>
        <pre style={{ margin: '0 0 10px', background: '#070c17', border: '1px solid rgba(148,163,184,.22)', borderRadius: 8, padding: '10px 12px', fontSize: '0.78rem', overflowX: 'auto' }}>
          {STEPS.map((s, i) => <code key={i} style={{ display: 'block', background: 'none', color: i < k ? (i === k - 1 ? '#4fc3cd' : '#e2e8f0') : '#475569' }}>{s[code]}</code>)}
        </pre>
        <svg className="chart" viewBox={`0 0 ${W} ${STEPS.length * (BH + GAP)}`} width="100%" role="img" aria-label={T.fig}>
          <title>{T.fig}</title>
          {done.map((s, i) => {
            const y = i * (BH + GAP), last = s.computed;
            return <g key={i}>
              {i > 0 && <line x1={W / 2} x2={W / 2} y1={y - GAP} y2={y} stroke="#94a3b8" markerEnd="url(#lz)" />}
              <rect x={W / 2 - 150} y={y} width={300} height={BH} rx={8} fill={last ? 'rgba(227,178,90,.18)' : 'rgba(79,195,205,.12)'} stroke={last ? '#e3b25a' : '#4fc3cd'} />
              <text x={W / 2} y={y + BH / 2 + 4} textAnchor="middle" style={{ fill: '#e2e8f0' }}>{s.node}</text>
            </g>;
          })}
          <defs><marker id="lz" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="#94a3b8" /></marker></defs>
        </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.step, v: `${k} / ${STEPS.length}`, tone: 'accent' },
          { k: T.browser, v: computed ? T.obj(k - 1) : T.obj(k), tone: 'muted' },
          { k: T.sent, v: computed ? T.yes : T.no, tone: computed ? 'warn' : 'ok' },
          { k: T.pix, v: computed ? T.tiles : T.none, tone: computed ? 'warn' : 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <button type="button" className="pill-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setK(Math.min(STEPS.length, k + 1))} disabled={k === STEPS.length}>{T.next} →</button>
        <button type="button" className="pill-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setK(1)}>{T.reset}</button>
        <Pills label={T.lang} value={code} onChange={setCode} options={[{ v: 'js', label: 'JavaScript' }, { v: 'py', label: 'Python' }]} />
      </div>
    </div>
  );
}
