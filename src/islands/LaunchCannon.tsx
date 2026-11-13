import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { cannon, circularV, RE } from '../lib/launch';
import { Slider, StatPanel } from './VizUi';

const TXT = {
  vi: { fig: 'Khẩu pháo Newton: bắn ngang từ đỉnh núi tưởng tượng', v: 'Vận tốc ngang', h: 'Độ cao điểm bắn', title: 'Đường bay',
        vc: 'Vận tốc vòng tròn √(μ/r)', ve: 'Vận tốc thoát √(2μ/r)', ratio: 'v so với v vòng tròn', out: 'Kết quả', range: 'Bay được (dọc mặt đất)', apo: 'Độ cao xa nhất',
        impact: 'Rơi xuống đất', orbit: 'Bay quanh Trái Đất', escape: 'Thoát khỏi Trái Đất', quick: 'Thử nhanh', note: 'Không khí và tự quay của Trái Đất bị bỏ qua.' },
  en: { fig: "Newton's cannon: firing horizontally from an imaginary mountain", v: 'Horizontal speed', h: 'Firing height', title: 'Trajectory',
        vc: 'Circular speed √(μ/r)', ve: 'Escape speed √(2μ/r)', ratio: 'v / circular speed', out: 'Outcome', range: 'Ground distance flown', apo: 'Highest point',
        impact: 'Hits the ground', orbit: 'Circles the Earth', escape: 'Escapes the Earth', quick: 'Quick picks', note: 'Air and Earth rotation are ignored.' },
};

export default function LaunchCannon({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [v, setV] = useState(6);
  const [h, setH] = useState(400);
  const shot = useMemo(() => cannon(h, v), [h, v]);
  const vc = circularV(h), ve = Math.SQRT2 * vc;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 2) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const S = 360, C = S / 2, k = (S * 0.33) / RE; // Earth radius 33 % of the panel; far points are clipped
  const P = (x: number) => Math.round(x * k * 10) / 10;
  const path = shot.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${C + P(x)},${C - P(y)}`).join('');
  const tone = shot.outcome === 'impact' ? 'bad' : shot.outcome === 'orbit' ? 'ok' : 'warn';

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${S} ${S}`} width="100%" style={{ maxWidth: 520, justifySelf: 'center' }} role="img"
        aria-label={`${T.fig}: ${T[shot.outcome]}`}>
        <defs><clipPath id="cannon-clip"><rect width={S} height={S} /></clipPath></defs>
        <circle cx={C} cy={C} r={P(RE)} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} strokeWidth={1.5} />
        <circle cx={C} cy={C} r={P(RE + h)} fill="none" style={{ stroke: 'var(--border)' }} strokeDasharray="3 4" />
        <path d={path} fill="none" clipPath="url(#cannon-clip)" style={{ stroke: `var(--${tone === 'warn' ? 'accent' : tone})` }} strokeWidth={2.2} />
        <line x1={C} x2={C} y1={C - P(RE)} y2={C - P(RE + h)} style={{ stroke: 'var(--fg-3)' }} strokeWidth={3} />
        <circle cx={C} cy={C - P(RE + h)} r={4} style={{ fill: 'var(--fg)' }} />
        <text x={C + 8} y={C - P(RE + h) - 8} style={{ fill: 'var(--accent)', font: '600 11px var(--font-mono)' }}>→ v = {nf(v)} km/s</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.out, v: T[shot.outcome], tone },
          { k: T.vc, v: `${nf(vc)} km/s`, tone: 'accent' },
          { k: T.ve, v: `${nf(ve)} km/s` },
          { k: T.ratio, v: `${Math.round((100 * v) / vc)} %` },
          { k: T.range, v: shot.outcome === 'orbit' ? '∞' : `${Math.round(shot.rangeKm).toLocaleString(loc)} km` },
          { k: T.apo, v: shot.outcome === 'escape' ? '∞' : `${Math.round(shot.apoKm).toLocaleString(loc)} km` },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Slider label={T.v} value={v} min={1} max={12} step={0.01} fmt={(x) => `${nf(x)} km/s`} onChange={setV} />
        <Slider label={T.h} value={h} min={100} max={2000} step={50} fmt={(x) => `${x.toLocaleString(loc)} km`} onChange={setH} />
        <div className="ctl">
          <span className="ctl-label">{T.quick}</span>
          <div className="pills">
            {[4, 7, vc, 9.5, ve + 0.05].map((q) => <button key={q} type="button" className="pill-btn" onClick={() => setV(Math.round(q * 100) / 100)}>{nf(q)}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
