import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Pills, StatPanel } from './VizUi';

// How several users share one satellite channel: who gets which slice of the time–frequency plane.
type Mode = 'fdma' | 'tdma' | 'mftdma' | 'cdma' | 'ofdma';
const USERS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7']; // Okabe-Ito, users also labelled A–D
const NT = 12, NF = 8;
const owner = (m: Mode, t: number, f: number): number | null => {
  if (m === 'fdma') return f % 2 === 1 ? null : f / 2; // guard bands between carriers
  if (m === 'tdma') return t % 4;
  if (m === 'mftdma') return (Math.floor(f / 4) * 2 + (t % 2) + Math.floor(t / 3)) % 4;
  if (m === 'ofdma') return [0, 0, 1, 2, 2, 3, 1, 3][(f + Math.floor(t / 2) * 3) % 8];
  return null;
};

const TXT = {
  vi: { aria: 'Mặt phẳng thời gian – tần số của một kênh vệ tinh, tô màu theo người dùng được cấp', mode: 'Cách chia', t: 'Thời gian →', f: 'Tần số →',
        users: 'Người dùng A–D', guard: 'khoảng bảo vệ', code: 'Mỗi người một mã trải phổ, cùng tần số, cùng lúc',
        info: {
          fdma: ['FDMA: mỗi người một khe tần số, phát liên tục', 'Trung kế, truyền hình (mỗi sóng mang một khe); SCPC', 'Đơn giản, không cần đồng bộ thời gian', 'Phí băng thông cho khoảng bảo vệ; bộ khuếch đại vệ tinh nhiều sóng mang phải lùi công suất'],
          tdma: ['TDMA: cả băng tần, luân phiên theo khe thời gian', 'Iridium, mạng VSAT cũ', 'Bộ khuếch đại chạy gần bão hòa (một sóng mang)', 'Cần đồng bộ thời gian chặt; mỗi người phát thành cụm tốc độ cao'],
          mftdma: ['MF-TDMA: nhiều sóng mang, mỗi sóng mang chia khe thời gian', 'Mạng VSAT hiện đại (đường lên DVB-RCS2)', 'Linh hoạt: cấp khe theo nhu cầu', 'Cần bộ lập lịch trung tâm'],
          cdma: ['CDMA: mọi người dùng toàn bộ băng, mọi lúc; tách nhau bằng mã', 'GPS, Galileo, BeiDou (mỗi vệ tinh một mã)', 'Chịu nhiễu và nghe lén tốt; trải phổ cho độ lợi xử lý', 'Người gần lấn át người xa; tổng dung lượng bị giới hạn bởi nhiễu lẫn nhau'],
          ofdma: ['OFDMA: nhiều sóng mang con trực giao, cấp theo khối', '4G/5G; đường xuống Starlink dùng OFDM (Humphreys và cộng sự, 2023)', 'Hiệu quả phổ cao, chống fading chọn lọc tần số', 'Nhạy với lệch tần (Doppler) và méo phi tuyến'] },
        k: ['Nguyên tắc', 'Dùng ở', 'Ưu điểm', 'Nhược điểm'] },
  en: { aria: 'Time–frequency plane of one satellite channel, coloured by the user it is assigned to', mode: 'Scheme', t: 'Time →', f: 'Frequency →',
        users: 'Users A–D', guard: 'guard band', code: 'Each user has its own spreading code: same frequency, same time',
        info: {
          fdma: ['FDMA: one frequency slot per user, transmitting continuously', 'Trunking, TV (one carrier per slot); SCPC', 'Simple, no time synchronisation', 'Bandwidth lost to guard bands; a multi-carrier satellite amplifier must back off'],
          tdma: ['TDMA: the whole band, taking turns in time slots', 'Iridium, older VSAT networks', 'Amplifier runs near saturation (one carrier)', 'Needs tight timing; each user bursts at a high rate'],
          mftdma: ['MF-TDMA: several carriers, each divided into time slots', 'Modern VSAT networks (DVB-RCS2 return link)', 'Flexible: slots assigned on demand', 'Needs a central scheduler'],
          cdma: ['CDMA: everyone uses the whole band all the time, separated by codes', 'GPS, Galileo, BeiDou (one code per satellite)', 'Robust to interference and eavesdropping; spreading gives processing gain', 'Near users drown far ones; total capacity limited by mutual interference'],
          ofdma: ['OFDMA: many orthogonal subcarriers, assigned in blocks', '4G/5G; the Starlink downlink uses OFDM (Humphreys et al., 2023)', 'High spectral efficiency, resists frequency-selective fading', 'Sensitive to frequency offset (Doppler) and non-linear distortion'] },
        k: ['Principle', 'Used in', 'Strength', 'Weakness'] },
};

export default function SignalAccess({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [mode, setMode] = useState<Mode>('fdma');
  const X0 = 50, Y0 = 20, CW = 36, CH = 30, W = X0 + NT * CW + 20, H = Y0 + NF * CH + 60;
  const info = T.info[mode];

  return (
    <div className="dark-card">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={T.aria} width="100%" style={{ display: 'block' }}>
        <rect x={X0} y={Y0} width={NT * CW} height={NF * CH} style={{ fill: 'var(--surface-2)', stroke: 'var(--border)' }} />
        {mode === 'cdma' ? USERS.map((c, u) => (
          <g key={u}>
            <rect x={X0 + 4 + u * 4} y={Y0 + 4 + u * 4} width={NT * CW - 20} height={NF * CH - 20} rx={4} fill={c} opacity={0.22} stroke={c} strokeWidth={1.5} />
            <text x={X0 + NT * CW - 24 + u * 4} y={Y0 + 20 + u * 16} textAnchor="end" style={{ fontSize: 12, fontWeight: 700 }} fill={c}>{'ABCD'[u]}</text>
          </g>
        )) : Array.from({ length: NT * NF }, (_, i) => {
          const t = i % NT, f = Math.floor(i / NT), o = owner(mode, t, f);
          return o === null ? null : (
            <g key={i}>
              <rect x={X0 + t * CW + 1.5} y={Y0 + (NF - 1 - f) * CH + 1.5} width={CW - 3} height={CH - 3} rx={2} fill={USERS[o]} opacity={0.85} />
              <text x={X0 + t * CW + CW / 2} y={Y0 + (NF - 1 - f) * CH + CH / 2 + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#fff' }}>{'ABCD'[o]}</text>
            </g>
          );
        })}
        {mode === 'fdma' && <text x={X0 + NT * CW / 2} y={Y0 + (NF - 2) * CH + CH / 2 + 4} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--fg-3)' }}>{T.guard}</text>}
        {mode === 'cdma' && <text x={X0 + 10} y={Y0 + NF * CH - 10} style={{ fontSize: 11, fill: 'var(--fg)' }}>{T.code}</text>}
        <text x={X0 + NT * CW} y={Y0 + NF * CH + 18} textAnchor="end" style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.t}</text>
        <text transform={`translate(${X0 - 14} ${Y0 + NF * CH}) rotate(-90)`} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.f}</text>
        {USERS.map((c, u) => (
          <g key={u} transform={`translate(${X0 + u * 70},${H - 18})`}>
            <rect width={14} height={14} rx={3} fill={c} /><text x={20} y={11} style={{ fontSize: 12, fill: 'var(--fg)' }}>{'ABCD'[u]}</text>
          </g>
        ))}
      </svg>
      <div className="hud-static">
        <StatPanel title={info[0].split(':')[0]} rows={[]}>
          {T.k.map((k, i) => (
            <p key={k} style={{ margin: '0 0 8px', fontSize: '0.84rem', fontFamily: 'var(--font-body)' }}>
              <b style={{ color: i === 3 ? 'var(--bad)' : i === 2 ? 'var(--ok)' : 'var(--primary)' }}>{k}:</b> {i === 0 ? info[0].split(': ')[1] : info[i]}
            </p>
          ))}
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.mode} value={mode} onChange={setMode} options={(['fdma', 'tdma', 'mftdma', 'cdma', 'ofdma'] as Mode[]).map((m) => ({ v: m, label: m === 'mftdma' ? 'MF-TDMA' : m.toUpperCase() }))} />
      </div>
    </div>
  );
}
