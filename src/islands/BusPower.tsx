import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { betaAngle, nodeFromSun, powerSim } from '../lib/bus';
import { niceTicks } from '../lib/chart';
import { Pills, Slider, StatPanel } from './VizUi';

type Preset = 'b0' | 'sso' | 'dd';
// beta at equinox: orbit plane facing the Sun edge-on, Sentinel-2-like 10:30 SSO, dawn-dusk SSO (06:00/18:00 nodes)
const BETA: Record<Preset, number> = {
  b0: 0, sso: Math.round(betaAngle(98.6, nodeFromSun(10.5), 0) * 10) / 10, dd: Math.round(betaAngle(98.2, nodeFromSun(6), 0) * 10) / 10,
};
const CELLS = { si: 0.15, gaas: 0.28 } as const;

const TXT = {
  vi: { fig: 'Mức pin qua ba vòng quỹ đạo', alt: 'Độ cao', beta: 'Góc beta', presets: 'Quỹ đạo', b0: 'β = 0°', sso: 'SSO 10:30', dd: 'Bình minh–hoàng hôn',
        area: 'Diện tích pin mặt trời', cell: 'Loại tế bào', si: 'Si 15 %', gaas: 'GaAs 3 lớp 28 %', load: 'Tải tiêu thụ', batt: 'Dung lượng pin',
        title: 'Ngân sách điện', T: 'Chu kỳ', ecl: 'Trong bóng tối', gen: 'Phát khi có nắng', avg: 'Trung bình cả vòng', need: 'Công suất mảng cần', needA: 'Diện tích cần (SMAD)',
        dod: 'Độ xả sâu (DoD)', margin: 'Dư năng lượng mỗi vòng', ok: 'Cân bằng', bad: 'Thiếu điện: pin cạn dần', soc: 'Mức pin (%)', t: 'Thời gian (phút)', shade: 'bóng Trái Đất' },
  en: { fig: 'Battery charge over three orbits', alt: 'Altitude', beta: 'Beta angle', presets: 'Orbit', b0: 'β = 0°', sso: 'SSO 10:30', dd: 'Dawn–dusk',
        area: 'Solar array area', cell: 'Cell type', si: 'Si 15 %', gaas: 'Triple-junction GaAs 28 %', load: 'Load', batt: 'Battery capacity',
        title: 'Power budget', T: 'Period', ecl: 'In eclipse', gen: 'Output in sunlight', avg: 'Orbit average', need: 'Array power needed', needA: 'Area needed (SMAD)',
        dod: 'Depth of discharge', margin: 'Energy margin per orbit', ok: 'Balanced', bad: 'Power deficit: battery drains', soc: 'Charge (%)', t: 'Time (min)', shade: 'Earth shadow' },
};

export default function BusPower({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alt, setAlt] = useState(786);
  const [beta, setBeta] = useState(BETA.sso);
  const [area, setArea] = useState(2.5);
  const [cell, setCell] = useState<keyof typeof CELLS>('gaas');
  const [load, setLoad] = useState(300);
  const [batt, setBatt] = useState(900);
  const p = powerSim({ altKm: alt, betaDeg: beta, areaM2: area, eff: CELLS[cell], loadW: load, battWh: batt });
  const preset = (Object.keys(BETA) as Preset[]).find((k) => BETA[k] === beta) ?? ('' as Preset);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const W = 640, H = 280, L = 46, R = 12, TOP = 14, B = 38;
  const tMax = p.T * 3;
  const x = (t: number) => Math.round((L + (t / tMax) * (W - L - R)) * 10) / 10;
  const y = (s: number) => Math.round((TOP + (1 - s / 100) * (H - TOP - B)) * 10) / 10;
  const path = p.soc.map(([t, s], i) => `${i ? 'L' : 'M'}${x(t)},${y(s)}`).join('');

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${T.dod} ${nf(100 * p.dod, 1)} %`}>
        {[0, 1, 2].map((k) => p.te > 0 && <rect key={k} x={x(k * p.T + p.td)} y={TOP} width={x(p.te) - L} height={H - TOP - B} style={{ fill: 'var(--surface-2)' }} />)}
        {p.te > 0 && <text x={x(p.td + p.te / 2)} y={H - B - 8} textAnchor="middle" style={{ fontSize: 11 }}>{T.shade}</text>}
        {[0, 25, 50, 75, 100].map((v) => <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text>
        </g>)}
        {niceTicks(0, tMax, 6).filter((t) => t <= tMax).map((t) => <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle">{t}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{T.t}</text>
        <text x={12} y={(TOP + H - B) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(TOP + H - B) / 2})`}>{T.soc}</text>
        <path d={path} fill="none" style={{ stroke: p.ok ? 'var(--chart-1)' : 'var(--bad)' }} strokeWidth={2.5} />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.T, v: `${nf(p.T, 1)} min` },
          { k: T.ecl, v: `${nf(p.te, 1)} min · ${nf(100 * p.f, 1)} %`, tone: 'muted' },
          { k: T.gen, v: `${nf(p.genW)} W`, tone: 'accent' },
          { k: T.avg, v: `${nf(p.orbitAvgW)} W` },
          { k: T.need, v: `${nf(p.needW)} W` },
          { k: T.needA, v: `${nf(p.needArea, 2)} m²`, tone: area >= p.needArea ? 'ok' : 'warn' },
          { k: T.dod, v: `${nf(100 * p.dod, 1)} %`, tone: p.dod > 0.4 ? 'warn' : undefined },
          { k: T.margin, v: `${nf(p.marginWh)} Wh`, tone: p.ok ? 'ok' : 'bad' },
          { k: '', v: p.ok ? T.ok : T.bad, tone: p.ok ? 'ok' : 'bad' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.presets} value={preset} onChange={(k) => setBeta(BETA[k])} options={(Object.keys(BETA) as Preset[]).map((k) => ({ v: k, label: T[k] }))} />
        <Slider label={T.beta} value={beta} min={0} max={85} step={0.1} fmt={(v) => `${nf(v, 1)}°`} onChange={setBeta} />
        <Slider label={T.alt} value={alt} min={300} max={1200} step={10} fmt={(v) => `${v} km`} onChange={setAlt} />
        <Pills label={T.cell} value={cell} onChange={setCell} options={[{ v: 'si', label: T.si }, { v: 'gaas', label: T.gaas }]} />
        <Slider label={T.area} value={area} min={0.2} max={8} step={0.1} fmt={(v) => `${nf(v, 1)} m²`} onChange={setArea} />
        <Slider label={T.load} value={load} min={10} max={1500} step={10} fmt={(v) => `${v} W`} onChange={setLoad} />
        <Slider label={T.batt} value={batt} min={50} max={3000} step={50} fmt={(v) => `${v} Wh`} onChange={setBatt} />
      </div>
    </div>
  );
}
