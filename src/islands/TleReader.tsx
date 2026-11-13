import { useState, type ReactNode } from 'react';
import type { Lang } from '../i18n/ui';
import { parseTle, type TleField } from '../lib/kepler';
import tle from '../../public/data/ch02-tle.json';
import { StatPanel } from './VizUi';
import { fmt } from './ch02anim';

const t = parseTle(tle.line1, tle.line2);
type Group = 'id' | 'time' | 'drag' | 'orient' | 'shape' | 'pos' | 'check';
const GROUP: Record<string, Group> = {
  line: 'check', norad: 'id', class: 'id', intlYear: 'id', intlLaunch: 'id', intlPiece: 'id', epochYear: 'time', epochDay: 'time',
  ndot: 'drag', nddot: 'drag', bstar: 'drag', ephType: 'check', elset: 'check', check: 'check',
  inc: 'orient', raan: 'orient', argp: 'orient', ecc: 'shape', mm: 'shape', ma: 'pos', rev: 'pos',
};
const GCOL: Record<Group, string> = { id: 'var(--chart-6)', time: 'var(--chart-2)', drag: 'var(--chart-4)', orient: 'var(--chart-3)', shape: 'var(--chart-1)', pos: 'var(--chart-5)', check: 'var(--fg-3)' };

const TXT = {
  vi: {
    title: 'Trường đang chọn', raw: 'Ký tự', cols: 'Cột', val: 'Giải mã', hint: 'Chạm hoặc di chuột lên từng nhóm ký tự.',
    groups: { id: 'Định danh', time: 'Thời điểm (epoch)', drag: 'Lực cản', orient: 'Định hướng', shape: 'Kích thước, hình dạng', pos: 'Vị trí', check: 'Kiểm tra' } as Record<Group, string>,
    derived: 'Suy ra từ chuyển động trung bình', T: 'Chu kỳ', a: 'Bán trục lớn', h: 'Cận địa · viễn địa', ok: 'đúng', bad: 'SAI',
  },
  en: {
    title: 'Selected field', raw: 'Characters', cols: 'Columns', val: 'Decoded', hint: 'Tap or hover over each group of characters.',
    groups: { id: 'Identity', time: 'Time (epoch)', drag: 'Drag', orient: 'Orientation', shape: 'Size, shape', pos: 'Position', check: 'Checks' } as Record<Group, string>,
    derived: 'Derived from the mean motion', T: 'Period', a: 'Semi-major axis', h: 'Perigee · apogee', ok: 'valid', bad: 'INVALID',
  },
};

/** Name, decoded value and meaning of one field, per language. */
const describe = (f: TleField, lang: Lang): [string, string, string] => {
  const nf = fmt(lang), vi = lang === 'vi';
  const ep = new Date(t.epochMs).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  switch (f.key) {
    case 'line': return vi ? ['Số dòng', f.raw, 'Dòng 1 hay dòng 2 của bộ TLE.'] : ['Line number', f.raw, 'Line 1 or line 2 of the set.'];
    case 'norad': return vi ? ['Số hiệu NORAD', String(t.norad), 'Mã của vật thể trong danh mục theo dõi của Lực lượng Không gian Mỹ; lặp lại ở cả hai dòng.'] : ['NORAD catalogue number', String(t.norad), 'The object’s number in the US Space Force catalogue; repeated on both lines.'];
    case 'class': return vi ? ['Mức phân loại', f.raw, 'U = unclassified, dữ liệu công khai.'] : ['Classification', f.raw, 'U = unclassified, public data.'];
    case 'intlYear': return vi ? ['Mã quốc tế: năm phóng', String(t.launchYear), 'Hai số cuối của năm phóng.'] : ['International designator: launch year', String(t.launchYear), 'Last two digits of the launch year.'];
    case 'intlLaunch': return vi ? ['Mã quốc tế: lần phóng', String(Number(f.raw)), 'Thứ tự lần phóng trong năm (COSPAR).'] : ['International designator: launch number', String(Number(f.raw)), 'Launch number of that year (COSPAR).'];
    case 'intlPiece': return vi ? ['Mã quốc tế: mảnh', f.raw.trim(), 'Vật thể thứ mấy của lần phóng: A, B, C…'] : ['International designator: piece', f.raw.trim(), 'Which object of that launch: A, B, C…'];
    case 'epochYear': return vi ? ['Epoch: năm', String(new Date(t.epochMs).getUTCFullYear()), 'Năm của thời điểm tham số có hiệu lực.'] : ['Epoch: year', String(new Date(t.epochMs).getUTCFullYear()), 'Year of the instant the elements refer to.'];
    case 'epochDay': return vi ? ['Epoch: ngày trong năm', `${nf(t.epochDay, 8)} → ${ep}`, 'Ngày thứ mấy trong năm, kèm phần lẻ của ngày. Ngày 1 là 1/1 lúc 00:00 UTC.'] : ['Epoch: day of year', `${nf(t.epochDay, 8)} → ${ep}`, 'Day of the year with its fraction. Day 1 is 1 January 00:00 UTC.'];
    case 'ndot': return vi ? ['ṅ/2', `${t.ndot} vòng/ngày²`, 'Nửa đạo hàm bậc nhất của chuyển động trung bình. Dương: quỹ đạo đang hạ dần vì lực cản. SGP4 không dùng trường này.'] : ['ṅ/2', `${t.ndot} rev/day²`, 'Half the first derivative of mean motion. Positive: the orbit is decaying under drag. SGP4 does not use it.'];
    case 'nddot': return vi ? ['n̈/6', `${t.nddot}`, 'Đạo hàm bậc hai chia 6, gần như luôn bằng 0.'] : ['n̈/6', `${t.nddot}`, 'Second derivative over 6, almost always zero.'];
    case 'bstar': return vi ? ['BSTAR', `${t.bstar.toExponential(4)} /bán kính Trái Đất`, 'Hệ số cản dùng trong SGP4. Viết tắt: "10880-3" = 0,10880 × 10⁻³ (dấu thập phân ngầm ở đầu).'] : ['BSTAR', `${t.bstar.toExponential(4)} /Earth radii`, 'Drag term used by SGP4. Shorthand: "10880-3" = 0.10880 × 10⁻³ (leading decimal point implied).'];
    case 'ephType': return vi ? ['Loại mô hình', f.raw, '0: dùng với SGP4/SDP4.'] : ['Ephemeris type', f.raw, '0: for use with SGP4/SDP4.'];
    case 'elset': return vi ? ['Số thứ tự bộ phần tử', String(Number(f.raw)), 'Tăng mỗi khi phát hành bộ mới cho vật thể này.'] : ['Element set number', String(Number(f.raw)), 'Increases each time a new set is issued for this object.'];
    case 'check': { const ok = t.checks[f.line - 1]; return vi ? ['Tổng kiểm tra', `${f.raw} (${ok ? TXT.vi.ok : TXT.vi.bad})`, 'Cộng mọi chữ số của dòng, dấu trừ tính là 1, lấy phần dư khi chia 10: phát hiện lỗi gõ.'] : ['Checksum', `${f.raw} (${ok ? TXT.en.ok : TXT.en.bad})`, 'Sum of all digits on the line, minus signs count 1, modulo 10: catches typing errors.']; }
    case 'inc': return vi ? ['Độ nghiêng i', `${nf(t.inc, 4)}°`, 'Lớn hơn 90°: quỹ đạo hơi nghịch hành, đồng bộ Mặt Trời (mục 2.5).'] : ['Inclination i', `${nf(t.inc, 4)}°`, 'Above 90°: slightly retrograde, sun-synchronous (section 2.5).'];
    case 'raan': return vi ? ['Kinh độ nút lên Ω', `${nf(t.raan, 4)}°`, 'Góc từ điểm xuân phân tới nút lên, trên mặt phẳng xích đạo.'] : ['RAAN Ω', `${nf(t.raan, 4)}°`, 'Angle from the vernal equinox to the ascending node, in the equatorial plane.'];
    case 'ecc': return vi ? ['Tâm sai e', nf(t.ecc, 7), 'Dấu thập phân ngầm ở đầu: "0001582" = 0,0001582. Gần như tròn: cận địa và viễn địa chỉ chênh vài km.'] : ['Eccentricity e', nf(t.ecc, 7), 'Leading decimal point implied: "0001582" = 0.0001582. Nearly circular: perigee and apogee differ by a few km.'];
    case 'argp': return vi ? ['Góc cận địa ω', `${nf(t.argp, 4)}°`, 'Với quỹ đạo gần tròn, cận địa khó xác định nên ω thay đổi nhiều giữa các bộ.'] : ['Argument of perigee ω', `${nf(t.argp, 4)}°`, 'For a near-circular orbit perigee is ill-defined, so ω jumps between sets.'];
    case 'ma': return vi ? ['Dị thường trung bình M', `${nf(t.ma, 4)}°`, 'Vị trí trên quỹ đạo tại epoch, tính như thể vệ tinh chạy đều. ω + M ≈ góc từ nút lên tới vệ tinh.'] : ['Mean anomaly M', `${nf(t.ma, 4)}°`, 'Position along the orbit at epoch, as if the satellite moved uniformly. ω + M ≈ angle from the ascending node to the satellite.'];
    case 'mm': return vi ? ['Chuyển động trung bình n', `${nf(t.meanMotion, 8)} vòng/ngày`, `Chu kỳ 1440/n = ${nf(t.periodMin, 2)} phút. Kepler III cho a = ${nf(t.a, 1)} km, tức độ cao khoảng ${nf(t.a - 6378.137)} km.`] : ['Mean motion n', `${nf(t.meanMotion, 8)} rev/day`, `Period 1440/n = ${nf(t.periodMin, 2)} min. Kepler III gives a = ${nf(t.a, 1)} km, an altitude of about ${nf(t.a - 6378.137)} km.`];
    case 'rev': return vi ? ['Số vòng tại epoch', nf(t.rev), 'Số vòng đã bay kể từ khi phóng (chỉ có 5 chữ số, quay về 0 sau 99 999).'] : ['Revolution number at epoch', nf(t.rev), 'Orbits flown since launch (only 5 digits, wraps after 99,999).'];
    default: return [f.key, f.raw, ''];
  }
};

export default function TleReader({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [sel, setSel] = useState<TleField>(t.fields.find((f) => f.key === 'mm')!);
  const [name, val, meaning] = describe(sel, lang);
  const lineOf = (n: 1 | 2, text: string) => {
    const out: ReactNode[] = [];
    let c = 0;
    for (const f of t.fields.filter((x) => x.line === n)) {
      if (f.start > c) out.push(<span key={`g${c}`}>{text.slice(c, f.start)}</span>);
      const on = sel === f, col = GCOL[GROUP[f.key]];
      out.push(<button key={f.key} type="button" onMouseEnter={() => setSel(f)} onFocus={() => setSel(f)} onClick={() => setSel(f)} aria-pressed={on}
        title={describe(f, lang)[0]}
        style={{ all: 'unset', cursor: 'pointer', whiteSpace: 'pre', color: col, background: on ? `color-mix(in srgb, ${col} 22%, transparent)` : 'transparent',
          borderBottom: `2px solid ${on ? col : `color-mix(in srgb, ${col} 45%, transparent)`}`, borderRadius: 2 }}>{f.raw}</button>);
      c = f.end;
    }
    return <div style={{ whiteSpace: 'pre' }}>{out}</div>;
  };

  return (
    <div className="dark-card">
      <div style={{ minWidth: 0 }}>
        <div style={{ overflowX: 'auto', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '14px 16px',
          font: '600 clamp(11px, 1.55vw, 14.5px)/1.9 var(--font-mono)', color: 'var(--fg)' }}>
          <div style={{ color: 'var(--fg-3)' }}>{tle.name}</div>
          {lineOf(1, tle.line1)}
          {lineOf(2, tle.line2)}
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', margin: '8px 0' }}>{T.hint}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '0.78rem' }}>
          {(Object.keys(T.groups) as Group[]).map((g) => <span key={g} className="key"><i aria-hidden="true" style={{ background: GCOL[g] }} />{T.groups[g]}</span>)}
        </div>
      </div>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: <b style={{ color: GCOL[GROUP[sel.key]] }}>{name}</b>, v: '' },
          { k: T.raw, v: <code>{sel.raw.trim() || '␠'}</code> },
          { k: T.cols, v: `${sel.start + 1}–${sel.end}` },
          { k: T.val, v: val, tone: 'accent' },
        ]}>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', lineHeight: 1.45 }} aria-live="polite">{meaning}</p>
        </StatPanel>
        <div style={{ marginTop: 12 }} />
        <StatPanel title={T.derived} rows={[
          { k: T.T, v: `${nf(t.periodMin, 2)} min` },
          { k: T.a, v: `${nf(t.a, 1)} km` },
          { k: T.h, v: `${nf(t.perigeeKm)} · ${nf(t.apogeeKm)} km` },
        ]} />
      </div>
    </div>
  );
}
