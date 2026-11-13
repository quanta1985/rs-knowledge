import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dvToOrbit, gtoBurn, maxPayloadFrac, staged } from '../lib/launch';
import { Pills, Slider, StatPanel } from './VizUi';

// Δv the rocket must supply from Kourou (5.2° N) with the chapter's loss allowance; GTO adds the perigee burn.
const TARGETS = [
  { id: 'leo', dv: dvToOrbit(5.2, 5.2), label: { vi: 'LEO 200 km', en: 'LEO 200 km' } },
  { id: 'sso', dv: dvToOrbit(5.2, 98), label: { vi: 'SSO (98°)', en: 'SSO (98°)' } },
  { id: 'gto', dv: dvToOrbit(5.2, 5.2) + gtoBurn(), label: { vi: 'GTO', en: 'GTO' } },
] as const;
const DV_MAX = 14; // km/s, chart scale

const TXT = {
  vi: { fig: 'Phương trình tên lửa và tách tầng', stages: 'Số tầng', isp: 'Xung lực riêng Isp', eps: 'Tỉ lệ kết cấu ε', pay: 'Tải trọng / khối lượng cất cánh',
        title: 'Kết quả', dv: 'Δv đạt được', ratio: 'Tỉ số khối lượng mỗi tầng', need: 'Cần', ok: 'đủ', short: 'thiếu', maxPay: 'Tải trọng tối đa lên', none: 'không thể',
        prop: 'Nhiên liệu', struct: 'Kết cấu', payload: 'Tải trọng', split: 'Khối lượng lúc cất cánh', from: 'Phóng từ Kourou, tổn thất 1,7 km/s' },
  en: { fig: 'Rocket equation and staging', stages: 'Stages', isp: 'Specific impulse Isp', eps: 'Structural ratio ε', pay: 'Payload / lift-off mass',
        title: 'Result', dv: 'Δv achieved', ratio: 'Mass ratio per stage', need: 'Needs', ok: 'enough', short: 'short', maxPay: 'Max payload to', none: 'impossible',
        prop: 'Propellant', struct: 'Structure', payload: 'Payload', split: 'Lift-off mass', from: 'Launch from Kourou, 1.7 km/s losses' },
};

export default function LaunchStaging({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [stages, setStages] = useState<'1' | '2' | '3'>('2');
  const [isp, setIsp] = useState(320);
  const [eps, setEps] = useState(0.1);
  const [payPct, setPayPct] = useState(2);
  const n = Number(stages);
  const s = staged({ isp, eps, payloadFrac: payPct / 100, stages: n });
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const W = 640, H = 250, L = 132, R = 16, BH = 26;
  // rounded to 0.1 px so server and browser maths agree at hydration
  const x = (dv: number) => Math.round((L + (Math.min(dv, DV_MAX) / DV_MAX) * (W - L - R)) * 10) / 10;
  const rows = [{ id: 'you', dv: s.dv, label: { vi: 'Tên lửa của bạn', en: 'Your rocket' } }, ...TARGETS];
  const split = [{ k: T.prop, v: s.prop, c: 'var(--chart-1)' }, { k: T.struct, v: s.struct, c: 'var(--chart-6)' }, { k: T.payload, v: s.payload, c: 'var(--chart-2)' }];

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: Δv ${nf(s.dv)} km/s`}>
        {[0, 2, 4, 6, 8, 10, 12, 14].map((v) => <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={8} y2={8 + rows.length * 40} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" />
          <text x={x(v)} y={rows.length * 40 + 24} textAnchor="middle">{v}</text>
        </g>)}
        <text x={(L + W - R) / 2} y={rows.length * 40 + 42} textAnchor="middle">Δv (km/s)</text>
        {rows.map((r, i) => {
          const y = 14 + i * 40, you = r.id === 'you';
          return <g key={r.id}>
            <text x={L - 8} y={y + BH / 2 + 4} textAnchor="end" style={{ fill: 'var(--fg)', fontWeight: you ? 600 : 400 }}>{r.label[lang]}</text>
            <rect x={L} y={y} width={x(r.dv) - L} height={BH} rx={3} style={{ fill: you ? 'var(--chart-1)' : 'var(--surface-2)', stroke: you ? 'none' : 'var(--border)' }} />
            <text x={x(r.dv) + 6} y={y + BH / 2 + 4} style={{ fill: 'var(--fg)', font: '600 12px var(--font-mono)' }}>{nf(r.dv)}</text>
          </g>;
        })}
        {TARGETS.map((t) => <line key={t.id} x1={x(t.dv)} x2={x(t.dv)} y1={10} y2={14 + BH + 4} style={{ stroke: s.dv >= t.dv ? 'var(--ok)' : 'var(--bad)' }} strokeWidth={2} />)}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.dv, v: `${nf(s.dv)} km/s`, tone: 'accent' },
          { k: T.ratio, v: nf(s.massRatio, 1) },
          ...TARGETS.map((t) => ({ k: `${T.need} ${t.label[lang]}`, v: `${nf(t.dv)} · ${s.dv >= t.dv ? T.ok : T.short}`, tone: (s.dv >= t.dv ? 'ok' : 'bad') as 'ok' | 'bad' })),
          ...TARGETS.map((t) => { const m = maxPayloadFrac(t.dv, isp, eps, n); return { k: `${T.maxPay} ${t.label[lang]}`, v: m > 0 ? `${nf(100 * m)} %` : T.none, tone: 'muted' as const }; }),
        ]}>
          <p className="stat-title" style={{ marginTop: 10 }}>{T.split}</p>
          <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden' }} role="img"
            aria-label={split.map((p) => `${p.k} ${nf(100 * p.v, 1)} %`).join(', ')}>
            {split.map((p) => <div key={p.k} style={{ width: `${100 * p.v}%`, minWidth: p.v > 0 ? 2 : 0, background: p.c }} />)}
          </div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{split.map((p) => `${p.k} ${nf(100 * p.v, 1)} %`).join(' · ')}</p>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>{T.from}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.stages} value={stages} onChange={setStages} options={(['1', '2', '3'] as const).map((v) => ({ v, label: v }))} />
        <Slider label={T.isp} value={isp} min={250} max={460} step={5} fmt={(v) => `${v} s`} onChange={setIsp} />
        <Slider label={T.eps} value={eps} min={0.04} max={0.2} step={0.01} fmt={(v) => nf(v)} onChange={setEps} />
        <Slider label={T.pay} value={payPct} min={0.2} max={10} step={0.1} fmt={(v) => `${nf(v, 1)} %`} onChange={setPayPct} />
      </div>
    </div>
  );
}
