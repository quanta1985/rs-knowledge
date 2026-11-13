import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { beamwidthDeg, db, delayMs, K_DB, linkBudget, rainAt, rainNoiseK, slantRangeKm, type RainTable } from '../lib/signals';
import sig from '../../public/data/signals/signals.json';
import { PRESETS, REQ, type PresetKey, type ReqKey } from './signalsData';
import { Pills, Slider, StatPanel } from './VizUi';

type RainKey = 'none' | '1.0' | '0.1' | '0.01';
const HN = { freqsGHz: sig.freqsGHz, A: sig.stations.hn.A } as RainTable;

const TXT = {
  vi: { preset: 'Kịch bản', x: 'LEO băng X (dữ liệu ảnh)', s: 'LEO băng S (TT&C)', ku: 'GEO băng Ku (truyền hình)', ka: 'GEO băng Ka (Internet, minh họa)', f: 'Tần số', el: 'Góc ngẩng', pt: 'Công suất phát',
        gt: 'Độ lợi anten phát', d: 'Chảo thu', tsys: 'Nhiệt độ hệ thống', rate: 'Tốc độ dữ liệu', rain: 'Mưa ở Hà Nội (vượt % thời gian/năm)', none: 'Không mưa',
        req: 'Eb/N0 cần', qpsk: 'QPSK không mã 9,6', dvbs2: 'DVB-S2 QPSK 3/4 2,3', shannon: 'Shannon −1,6',
        rows: ['Công suất phát', 'Độ lợi anten phát', 'Suy hao không gian tự do', 'Suy hao do mưa', 'Tổn hao khác', 'Độ lợi chảo thu',
               'Nhiệt độ nhiễu (cả nhiễu mưa)', 'Hằng số Boltzmann (−k)', 'Tốc độ dữ liệu', 'Eb/N0 cần'], margin: 'Biên dự trữ',
        title: 'Ngân sách đường truyền', range: 'Khoảng cách nghiêng', delay: 'Trễ một chiều', bw: 'Độ rộng búp chảo thu', eirp: 'EIRP', gT: 'G/T',
        tsysNow: 'Nhiệt độ hệ thống (có mưa)', cn0: 'C/N0', ebn0: 'Eb/N0', maxRate: 'Tốc độ tối đa với Eb/N0 cần', shannonRate: 'Giới hạn Shannon (băng thông vô hạn)', ok: 'Liên lạc được', bad: 'Không đủ',
        aria: 'Thác ngân sách đường truyền: mỗi thanh là một số hạng dB cộng dồn từ công suất phát tới biên dự trữ', illustrative: 'Thông số kịch bản là giá trị minh họa điển hình, không phải thông số công bố của một vệ tinh cụ thể.' },
  en: { preset: 'Scenario', x: 'LEO X-band (image data)', s: 'LEO S-band (TT&C)', ku: 'GEO Ku-band (TV)', ka: 'GEO Ka-band (broadband, illustrative)', f: 'Frequency', el: 'Elevation', pt: 'Transmit power',
        gt: 'Transmit antenna gain', d: 'Receive dish', tsys: 'System noise temperature', rate: 'Data rate', rain: 'Rain at Hanoi (exceeded % of the year)', none: 'No rain',
        req: 'Required Eb/N0', qpsk: 'Uncoded QPSK 9.6', dvbs2: 'DVB-S2 QPSK 3/4 2.3', shannon: 'Shannon −1.6',
        rows: ['Transmit power', 'Transmit antenna gain', 'Free-space path loss', 'Rain attenuation', 'Other losses', 'Receive dish gain',
               'Noise temperature (incl. rain noise)', 'Boltzmann constant (−k)', 'Data rate', 'Required Eb/N0'], margin: 'Link margin',
        title: 'Link budget', range: 'Slant range', delay: 'One-way delay', bw: 'Receive beamwidth', eirp: 'EIRP', gT: 'G/T',
        tsysNow: 'System temperature (with rain)', cn0: 'C/N0', ebn0: 'Eb/N0', maxRate: 'Highest rate at the required Eb/N0', shannonRate: 'Shannon bound (unlimited bandwidth)', ok: 'Link closes', bad: 'Link fails',
        aria: 'Link-budget waterfall: each bar is one dB term, accumulated from transmit power to link margin', illustrative: 'Scenario values are typical illustrations, not the published parameters of a particular satellite.' },
};

/** Width of the element, so SVG text stays true-size on phones. */
const useWidth = (fallback = 640) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

const fmtRate = (bps: number, lang: Lang) => {
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US', [v, u] = bps >= 1e9 ? [bps / 1e9, 'Gbit/s'] : bps >= 1e6 ? [bps / 1e6, 'Mbit/s'] : [bps / 1e3, 'kbit/s'];
  return `${v.toLocaleString(loc, { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u}`;
};

export default function SignalLink({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [preset, setPreset] = useState<PresetKey>('x');
  const [s, setS] = useState(() => ({ ...PRESETS.x.link, elDeg: PRESETS.x.elDeg }));
  const [rain, setRain] = useState<RainKey>('none');
  const [req, setReq] = useState<ReqKey>('dvbs2');
  const [boxRef, w] = useWidth();
  const pick = (k: PresetKey) => {
    setPreset(k); setS({ ...PRESETS[k].link, elDeg: PRESETS[k].elDeg });
    setReq((Object.keys(REQ) as ReqKey[]).find((r) => REQ[r] === PRESETS[k].link.reqEbN0Db) ?? 'qpsk');
  };
  const set = (k: keyof typeof s) => (v: number) => setS((o) => ({ ...o, [k]: v }));
  const altKm = PRESETS[preset].altKm, dKm = slantRangeKm(altKm, s.elDeg);
  const rainDb = rain === 'none' ? 0 : rainAt(HN, rain, s.fHz / 1e9, s.elDeg);
  const tsysK = s.tsysK + rainNoiseK(rainDb); // rain both attenuates and adds sky noise
  const o = linkBudget({ ...s, tsysK, dKm, rainDb, reqEbN0Db: REQ[req] });

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const terms = [o.ptDbw, s.gtDbi, -o.fsplDb, -rainDb, -s.otherDb, o.grDbi, -db(tsysK), -K_DB, -db(s.rateBps), -REQ[req]];
  let cum = 0;
  const bars = terms.map((t, i) => { const a = cum; cum += t; return { i, a, b: cum, t }; });
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.a, b.b))), hi = Math.max(0, ...bars.map((b) => Math.max(b.a, b.b)));
  const narrow = w < 560, LW = narrow ? 0 : 210, VW = 64, RH = narrow ? 40 : 24, top = 6;
  const X = (v: number) => LW + ((v - lo) / (hi - lo || 1)) * (w - LW - VW - 8);
  const H = top + (bars.length + 1) * RH + 22;
  const good = o.marginDb >= 0;

  return (
    <div className="dark-card">
      <div ref={boxRef}>
        <svg width={w} height={H} role="img" aria-label={T.aria} className="chart" style={{ display: 'block', maxWidth: '100%' }}>
          <line x1={X(0)} x2={X(0)} y1={top} y2={H - 20} style={{ stroke: 'var(--border)' }} />
          {bars.map(({ i, a, b, t }) => {
            const y = top + i * RH, x0 = X(Math.min(a, b)), x1 = X(Math.max(a, b));
            return <g key={i}>
              {narrow
                ? <text x={0} y={y + 10} style={{ fontSize: 11, fill: 'var(--fg-muted)' }}>{T.rows[i]}</text>
                : <text x={LW - 8} y={y + RH / 2 + 4} textAnchor="end" style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.rows[i]}</text>}
              <rect x={x0} width={Math.max(1.5, x1 - x0)} y={y + (narrow ? 18 : 4)} height={narrow ? 13 : RH - 8} rx={2}
                style={{ fill: t >= 0 ? 'var(--chart-1)' : 'var(--chart-4)', opacity: 0.85 }} />
              {i > 0 && <line x1={X(a)} x2={X(a)} y1={y - (narrow ? 9 : 4)} y2={y + (narrow ? 18 : 4)} style={{ stroke: 'var(--fg-3)', strokeDasharray: '2 2' }} />}
              <text x={w - 4} y={y + (narrow ? 11 : RH / 2 + 4)} textAnchor="end" className="num" style={{ fontSize: 12, fill: 'var(--fg)' }}>{t >= 0 ? '+' : '−'}{nf(Math.abs(t))}</text>
            </g>;
          })}
          {(() => {
            const y = top + bars.length * RH, x0 = X(Math.min(0, o.marginDb)), x1 = X(Math.max(0, o.marginDb));
            return <g>
              <text x={narrow ? 0 : LW - 8} y={narrow ? y + 10 : y + RH / 2 + 4} textAnchor={narrow ? 'start' : 'end'} style={{ fontSize: 12, fontWeight: 600, fill: 'var(--fg)' }}>{T.margin}</text>
              <rect x={x0} width={Math.max(2, x1 - x0)} y={y + (narrow ? 18 : 3)} height={narrow ? 13 : RH - 6} rx={2} style={{ fill: good ? 'var(--ok)' : 'var(--bad)' }} />
              <text x={w - 4} y={y + (narrow ? 11 : RH / 2 + 4)} textAnchor="end" style={{ fontSize: 12, fontWeight: 700, fill: good ? 'var(--ok)' : 'var(--bad)' }}>{o.marginDb >= 0 ? '+' : '−'}{nf(Math.abs(o.marginDb))} dB</text>
            </g>;
          })()}
          <text x={X(0)} y={H - 6} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--fg-3)' }}>0 dB</text>
        </svg>
        <p className="muted" style={{ fontSize: '0.78rem', margin: '6px 0 0' }}>{T.illustrative}</p>
      </div>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.range, v: `${Math.round(dKm).toLocaleString(loc)} km` },
          { k: T.delay, v: `${nf(delayMs(dKm), 2)} ms` },
          { k: T.eirp, v: `${nf(o.eirpDbw)} dBW` },
          { k: 'FSPL', v: `${nf(o.fsplDb)} dB`, tone: 'bad' },
          { k: T.gT, v: `${nf(o.gtDbK)} dB/K` },
          { k: T.tsysNow, v: `${Math.round(tsysK)} K`, tone: rainDb > 0 ? 'warn' : undefined },
          { k: T.bw, v: `${nf(beamwidthDeg(s.rxDiamM, s.fHz), 2)}°`, tone: 'muted' },
          { k: T.cn0, v: `${nf(o.cn0DbHz)} dB·Hz`, tone: 'accent' },
          { k: T.ebn0, v: `${nf(o.ebn0Db)} dB`, tone: 'accent' },
          { k: T.margin, v: `${nf(o.marginDb)} dB · ${good ? T.ok : T.bad}`, tone: good ? 'ok' : 'bad' },
          { k: T.maxRate, v: fmtRate(o.rateAtReqBps, lang) },
          { k: T.shannonRate, v: fmtRate(o.shannonBps, lang), tone: 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={pick} options={(['x', 's', 'ku', 'ka'] as PresetKey[]).map((k) => ({ v: k, label: T[k] }))} />
        <Slider label={T.f} value={s.fHz / 1e9} min={1} max={40} step={0.1} fmt={(v) => `${nf(v)} GHz`} onChange={(v) => set('fHz')(v * 1e9)} />
        <Slider label={T.el} value={s.elDeg} min={5} max={90} step={0.5} fmt={(v) => `${nf(v)}°`} onChange={set('elDeg')} />
        <Slider label={T.pt} value={db(s.ptW)} min={-10} max={23} step={0.5} fmt={(v) => `${nf(10 ** (v / 10), 10 ** (v / 10) < 10 ? 1 : 0)} W`} onChange={(v) => set('ptW')(10 ** (v / 10))} />
        <Slider label={T.gt} value={s.gtDbi} min={0} max={45} step={0.5} fmt={(v) => `${nf(v)} dBi`} onChange={set('gtDbi')} />
        <Slider label={T.d} value={s.rxDiamM} min={0.3} max={15} step={0.1} fmt={(v) => `${nf(v)} m`} onChange={set('rxDiamM')} />
        <Slider label={T.tsys} value={s.tsysK} min={50} max={600} step={10} fmt={(v) => `${v} K`} onChange={set('tsysK')} />
        <Slider label={T.rate} value={Math.log10(s.rateBps)} min={3} max={9.5} step={0.05} fmt={(v) => fmtRate(10 ** v, lang)} onChange={(v) => set('rateBps')(10 ** v)} />
        <Pills label={T.rain} value={rain} onChange={setRain} options={[{ v: 'none', label: T.none }, { v: '1.0', label: '1 %' }, { v: '0.1', label: '0,1 %' }, { v: '0.01', label: '0,01 %' }].map((o2) => ({ ...o2, label: lang === 'en' ? o2.label.replace(',', '.') : o2.label })) as { v: RainKey; label: string }[]} />
        <Pills label={T.req} value={req} onChange={setReq} options={(Object.keys(REQ) as ReqKey[]).map((k) => ({ v: k, label: `${T[k]} dB` }))} />
      </div>
    </div>
  );
}
