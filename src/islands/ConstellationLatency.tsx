import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { fibreMs, geoPathMs, greatCircleKm, leoMs } from '../lib/constellation';
import { Pills, Slider, StatPanel } from './VizUi';

const HN = { lat: 21.03, lon: 105.85 };
const DEST = [
  { id: 'sg', lat: 1.35, lon: 103.82, vi: 'Singapore', en: 'Singapore' },
  { id: 'tyo', lat: 35.68, lon: 139.69, vi: 'Tokyo', en: 'Tokyo' },
  { id: 'fra', lat: 50.11, lon: 8.68, vi: 'Frankfurt', en: 'Frankfurt' },
  { id: 'la', lat: 34.05, lon: -118.24, vi: 'Los Angeles', en: 'Los Angeles' },
  { id: 'sp', lat: -23.55, lon: -46.63, vi: 'São Paulo', en: 'São Paulo' },
];
const PATHS = [
  { id: 'fibre', color: 'var(--chart-6)' },
  { id: 'leo', color: 'var(--chart-1)' },
  { id: 'geo', color: 'var(--chart-2)' },
] as const;
type PathId = (typeof PATHS)[number]['id'];

const TXT = {
  vi: { title: 'Độ trễ khứ hồi tối thiểu từ Hà Nội', fibre: 'Cáp quang', leo: 'LEO + laser giữa vệ tinh', geo: 'GEO (bent-pipe)', route: 'Hệ số tuyến cáp',
        alt: 'Độ cao LEO', ms: 'ms khứ hồi', dest: 'Điểm đến', gc: 'Khoảng cách vòng lớn', hops: 'Số chặng GEO', axis: 'Thời gian khứ hồi (ms)',
        note: 'Chỉ tính thời gian ánh sáng đi trên đường truyền (cận dưới). Mạng thật cộng thêm thời gian xử lý, xếp hàng, chuyển mạch và đường vòng.' },
  en: { title: 'Minimum round-trip time from Hanoi', fibre: 'Fibre', leo: 'LEO + inter-satellite lasers', geo: 'GEO (bent pipe)', route: 'Cable route factor',
        alt: 'LEO altitude', ms: 'ms round trip', dest: 'Destination', gc: 'Great-circle distance', hops: 'GEO hops', axis: 'Round-trip time (ms)',
        note: 'Light travel time on the path only (a lower bound). Real networks add processing, queuing, switching and detours.' },
};

export default function ConstellationLatency({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [route, setRoute] = useState(1.5);
  const [alt, setAlt] = useState('480');
  const [pick, setPick] = useState('fra');
  // measure the rendered width so labels stay at true pixel size on phones (as LineChart does)
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows = DEST.map((d) => {
    const gc = greatCircleKm(HN.lat, HN.lon, d.lat, d.lon), g = geoPathMs(HN.lat, HN.lon, d.lat, d.lon);
    return { d, gc, hops: g.hops, rtt: { fibre: 2 * fibreMs(gc, route), leo: 2 * leoMs(gc, Number(alt)), geo: 2 * g.ms } as Record<PathId, number> };
  });
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const L = W < 480 ? 78 : 96, R = 58, ROW = 54, H = rows.length * ROW + 34, X1 = W - R, max = 1100;
  const ticks = W < 480 ? [0, 500, 1000] : [0, 200, 400, 600, 800, 1000];
  const sx = (v: number) => L + (v / max) * (X1 - L);
  const sel = rows.find((r) => r.d.id === pick)!;

  return (
    <div className="dark-card">
      <div ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.title}>
        <title>{T.title}</title>
        {ticks.map((v) => <g key={v} className="grid"><line x1={sx(v)} x2={sx(v)} y1={4} y2={H - 26} /></g>)}
        {rows.map((r, i) => (
          <g key={r.d.id} transform={`translate(0 ${8 + i * ROW})`} style={{ cursor: 'pointer' }} onClick={() => setPick(r.d.id)}>
            <text x={L - 8} y={22} textAnchor="end" style={{ fontWeight: r.d.id === pick ? 700 : 400, fill: 'var(--fg)' }}>{r.d[lang]}</text>
            {PATHS.map((p, j) => (
              <g key={p.id}>
                <rect x={L} y={4 + j * 14} width={Math.max(1, sx(r.rtt[p.id]) - L)} height={11} rx={2} style={{ fill: p.color }} opacity={r.d.id === pick ? 1 : 0.75} />
                <text x={sx(r.rtt[p.id]) + 4} y={13 + j * 14} style={{ fontSize: 10 }}>{nf(r.rtt[p.id])}{p.id === 'geo' && r.hops > 1 ? ' ×2' : ''}</text>
              </g>
            ))}
          </g>
        ))}
        <g className="axis">{ticks.map((v) => <text key={v} x={sx(v)} y={H - 12} textAnchor="middle">{v}</text>)}</g>
        <text x={(L + X1) / 2} y={H} textAnchor="middle" style={{ fontSize: 11 }}>{T.axis}</text>
      </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={`${lang === 'vi' ? 'Hà Nội' : 'Hanoi'} → ${sel.d[lang]}`} rows={[
          { k: T.gc, v: `${nf(sel.gc)} km`, tone: 'muted' },
          { k: T.fibre, v: `${nf(sel.rtt.fibre, 1)} ms` },
          { k: T.leo, v: `${nf(sel.rtt.leo, 1)} ms`, tone: 'accent' },
          { k: T.geo, v: `${nf(sel.rtt.geo, 1)} ms`, tone: 'warn' },
          { k: T.hops, v: String(sel.hops), tone: 'muted' },
        ]} />
        <div className="legend" style={{ marginTop: 8 }}>{PATHS.map((p) => <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i aria-hidden="true" style={{ width: 12, height: 10, borderRadius: 2, background: p.color, display: 'inline-block' }} />{T[p.id]}</span>)}</div>
        <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{T.note}</p>
      </div>
      <div className="bar-static">
        <Pills label={T.dest} value={pick} onChange={setPick} options={DEST.map((d) => ({ v: d.id, label: d[lang] }))} />
        <Pills label={T.alt} value={alt} onChange={setAlt} options={['340', '480', '550', '1200'].map((a) => ({ v: a, label: `${a} km` }))} />
        <Slider label={T.route} value={route} min={1} max={2.5} step={0.1} fmt={(v) => `×${nf(v, 1)}`} onChange={setRoute} />
      </div>
    </div>
  );
}
