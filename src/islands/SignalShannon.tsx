import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bestModcod, db, DVBS2, rainNoiseK, shannonEta } from '../lib/signals';
import LineChart, { Legend, type Marker, type Series } from './LineChart';
import { Slider, StatPanel } from './VizUi';

// Shannon bound vs DVB-S2 modes (ETSI EN 302 307-1 Table 13) and adaptive coding & modulation under a rain fade.
const MODS: [string, string, Marker][] = [['QPSK', '#0072B2', 'circle'], ['8PSK', '#E69F00', 'square'], ['16APSK', '#009E73', 'triangle'], ['32APSK', '#CC79A7', 'diamond']];
const TXT = {
  vi: { title: 'Hiệu suất phổ theo Es/N0: giới hạn Shannon và 28 chế độ DVB-S2', x: 'Es/N0 (dB)', y: 'Hiệu suất phổ (bit/s/Hz)', shannon: 'Giới hạn Shannon log₂(1 + Es/N0)',
        clear: 'Es/N0 khi trời quang', fade: 'Suy hao mưa', rs: 'Tốc độ ký hiệu', now: 'Es/N0 hiện tại (cả nhiễu mưa)', pick: 'MODCOD chọn (dự trữ ≥ 1 dB)', none: 'không chế độ nào đủ: mất tín hiệu',
        eta: 'Hiệu suất phổ', thr: 'Thông lượng', sh: 'Shannon cùng băng thông', gap: 'Cách giới hạn Shannon', head: 'Điều chế & mã hóa thích ứng (ACM)', tsys: 'T hệ thống trời quang 120 K' },
  en: { title: 'Spectral efficiency versus Es/N0: the Shannon bound and 28 DVB-S2 modes', x: 'Es/N0 (dB)', y: 'Spectral efficiency (bit/s/Hz)', shannon: 'Shannon bound log₂(1 + Es/N0)',
        clear: 'Clear-sky Es/N0', fade: 'Rain fade', rs: 'Symbol rate', now: 'Current Es/N0 (incl. rain noise)', pick: 'Chosen MODCOD (≥ 1 dB margin)', none: 'no mode closes: link lost',
        eta: 'Spectral efficiency', thr: 'Throughput', sh: 'Shannon, same bandwidth', gap: 'Gap to the Shannon bound', head: 'Adaptive coding & modulation (ACM)', tsys: 'clear-sky system temperature 120 K' },
};

export default function SignalShannon({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [clear, setClear] = useState(14.4);
  const [fade, setFade] = useState(0);
  const [rs, setRs] = useState(30);
  const TSYS = 120;
  // a rain fade A both weakens the carrier and raises the noise temperature by 275·(1 − 10^(−A/10)) K
  const now = clear - fade - db((TSYS + rainNoiseK(fade)) / TSYS);
  const m = bestModcod(now, 1);
  const series: Series[] = [
    { id: 'sh', label: T.shannon, color: 'currentColor', width: 2, points: Array.from({ length: 111 }, (_, i) => { const x = -4 + i * 0.2; return [x, shannonEta(x)] as [number, number]; }) },
    ...MODS.map(([mod, color, marker]) => ({ id: mod, label: `DVB-S2 ${mod}`, color, marker, width: 0,
      points: DVBS2.filter((q) => q.mod === mod).map((q) => [q.esn0, q.eta] as [number, number]) })),
  ];
  const shEsn0 = m ? db(2 ** m.eta - 1) : 0;

  return (
    <div className="dark-card">
      <div>
        <LineChart title={T.title} series={series} x={[-4, 18]} y={[0, 6]} xLabel={T.x} yLabel={T.y} xTicks={[-4, 0, 4, 8, 12, 16]}
          vline={now} hline={m ? m.eta : null} height={330} yFormat={(v) => nf(v, 0)} xFormat={(v) => String(v)} />
        <Legend items={series} />
      </div>
      <div className="hud-static">
        <StatPanel title={T.head} rows={[
          { k: T.now, v: `${nf(now)} dB`, tone: 'accent' },
          { k: T.pick, v: m ? `${m.mod} ${m.rate}` : T.none, tone: m ? 'ok' : 'bad' },
          ...(m ? [
            { k: T.eta, v: `${nf(m.eta, 2)} bit/s/Hz` },
            { k: `${T.thr} (${rs} Msym/s)`, v: `${nf(m.eta * rs, 0)} Mbit/s`, tone: 'warn' as const },
            { k: T.sh, v: `${nf(shannonEta(now) * rs, 0)} Mbit/s`, tone: 'muted' as const },
            { k: T.gap, v: `${nf(m.esn0 - shEsn0)} dB`, tone: 'muted' as const },
          ] : []),
        ]} />
        <p className="muted" style={{ fontSize: '0.74rem', margin: '6px 0 0' }}>{T.tsys}.</p>
      </div>
      <div className="bar-static">
        <Slider label={T.clear} value={clear} min={0} max={18} step={0.1} fmt={(v) => `${nf(v)} dB`} onChange={setClear} />
        <Slider label={T.fade} value={fade} min={0} max={15} step={0.1} fmt={(v) => `${nf(v)} dB`} onChange={setFade} />
        <Slider label={T.rs} value={rs} min={1} max={60} step={1} fmt={(v) => `${v} Msym/s`} onChange={setRs} />
      </div>
    </div>
  );
}
