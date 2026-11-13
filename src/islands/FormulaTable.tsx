import { useState } from 'react';
import { CHAPTERS } from '../data/chapters';
import { url, type Lang } from '../i18n/ui';

type Bi = { vi: string; en: string };
type Cat = 'orbit' | 'physics' | 'index' | 'sensor' | 'gis' | 'class' | 'sar' | 'dem';
type F = { name: Bi; f: string | Bi; note: Bi; cat: Cat; slug: string };

const CAT: Record<Cat, Bi> = {
  orbit: { vi: 'Quỹ đạo', en: 'Orbits' }, physics: { vi: 'Vật lý & bức xạ', en: 'Physics & radiometry' }, index: { vi: 'Chỉ số phổ', en: 'Spectral indices' },
  sensor: { vi: 'Cảm biến & dữ liệu', en: 'Sensors & data' }, gis: { vi: 'GIS', en: 'GIS' }, class: { vi: 'Phân loại & độ chính xác', en: 'Classification & accuracy' },
  sar: { vi: 'Radar', en: 'Radar' }, dem: { vi: 'Địa hình', en: 'Terrain' },
};

// Every formula used in the chapters (keep in sync when a chapter adds one).
const F_LIST: F[] = [
  { cat: 'orbit', slug: 'ch02-orbits', name: { vi: 'Vận tốc và chu kỳ quỹ đạo tròn', en: 'Circular orbit speed and period' }, f: { vi: 'v = √(μ / r),  T = 2π √(r³ / μ),  μ = 398 600,4 km³/s²', en: 'v = √(μ / r),  T = 2π √(r³ / μ),  μ = 398,600.4 km³/s²' },
    note: { vi: 'r = bán kính Trái Đất + độ cao', en: 'r = Earth radius + altitude' } },
  { cat: 'orbit', slug: 'ch02-orbits', name: { vi: 'Tuế sai nút do J2 (quỹ đạo đồng bộ Mặt Trời)', en: 'Nodal precession from J2 (sun-synchronous orbit)' }, f: 'dΩ/dt = −(3/2) · n · J2 · (Re / a)² · cos i',
    note: { vi: 'Đồng bộ Mặt Trời khi dΩ/dt = 360°/năm', en: 'Sun-synchronous when dΩ/dt = 360°/year' } },
  { cat: 'physics', slug: 'ch03-physics', name: { vi: 'Bước sóng và tần số', en: 'Wavelength and frequency' }, f: 'c = λ · f', note: { vi: 'c ≈ 3×10⁸ m/s', en: 'c ≈ 3×10⁸ m/s' } },
  { cat: 'physics', slug: 'ch03-physics', name: { vi: 'Định luật Wien, Stefan–Boltzmann', en: 'Wien and Stefan–Boltzmann laws' }, f: 'λmax = 2898 µm·K / T,   M = σ T⁴',
    note: { vi: 'σ = 5,67×10⁻⁸ W·m⁻²·K⁻⁴', en: 'σ = 5.67×10⁻⁸ W·m⁻²·K⁻⁴' } },
  { cat: 'physics', slug: 'ch03-physics', name: { vi: 'Phản xạ tại đỉnh khí quyển', en: 'Top-of-atmosphere reflectance' }, f: 'ρTOA = π · L · d² / (ESUN · cos θs)',
    note: { vi: 'L bức xạ, d khoảng cách Trái Đất–Mặt Trời (AU), θs góc thiên đỉnh Mặt Trời', en: 'L radiance, d Earth–Sun distance (AU), θs solar zenith angle' } },
  { cat: 'sensor', slug: 'ch07-preprocessing', name: { vi: 'Sentinel-2 L1C → phản xạ TOA', en: 'Sentinel-2 L1C → TOA reflectance' }, f: { vi: 'ρTOA = (DN + RADIO_ADD_OFFSET) / 10 000', en: 'ρTOA = (DN + RADIO_ADD_OFFSET) / 10,000' },
    note: { vi: 'S2_SR_HARMONIZED: ρ = DN / 10 000', en: 'S2_SR_HARMONIZED: ρ = DN / 10,000' } },
  { cat: 'sensor', slug: 'ch07-preprocessing', name: { vi: 'Hệ số quy đổi Landsat Collection 2 L2', en: 'Landsat Collection 2 L2 scale factors' }, f: { vi: 'ρ = DN × 0,0000275 − 0,2;   T(K) = DN × 0,00341802 + 149,0', en: 'ρ = DN × 0.0000275 − 0.2;   T(K) = DN × 0.00341802 + 149.0' },
    note: { vi: 'SR_B*, ST_B10', en: 'SR_B*, ST_B10' } },
  { cat: 'sensor', slug: 'ch04-resolution', name: { vi: 'Số mức lượng tử hóa', en: 'Quantisation levels' }, f: { vi: 'số mức = 2^bit', en: 'levels = 2^bits' }, note: { vi: '8 bit = 256, 12 bit = 4096', en: '8 bit = 256, 12 bit = 4096' } },
  { cat: 'sensor', slug: 'ch04-resolution', name: { vi: 'Mô hình trộn tuyến tính', en: 'Linear mixing model' }, f: 'ρ(pixel) = f · ρ(A) + (1 − f) · ρ(B)',
    note: { vi: 'NDVI < 0 khi f > (NIR_B − Đỏ_B) / [(NIR_B − Đỏ_B) − (NIR_A − Đỏ_A)]', en: 'NDVI < 0 when f > (NIR_B − Red_B) / [(NIR_B − Red_B) − (NIR_A − Red_A)]' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'Chỉ số chênh lệch chuẩn hóa', en: 'Normalised difference' }, f: '(A − B) / (A + B)', note: { vi: 'Luôn trong −1…+1', en: 'Always within −1…+1' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'NDVI', en: 'NDVI' }, f: { vi: '(NIR − Đỏ) / (NIR + Đỏ)', en: '(NIR − Red) / (NIR + Red)' }, note: { vi: 'S2: (B8 − B4)/(B8 + B4); Rouse và cs. 1974', en: 'S2: (B8 − B4)/(B8 + B4); Rouse et al. 1974' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'NDWI (McFeeters)', en: 'NDWI (McFeeters)' }, f: { vi: '(Lục − NIR) / (Lục + NIR)', en: '(Green − NIR) / (Green + NIR)' }, note: { vi: 'Nước > 0; McFeeters 1996', en: 'Water > 0; McFeeters 1996' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'MNDWI', en: 'MNDWI' }, f: { vi: '(Lục − SWIR1) / (Lục + SWIR1)', en: '(Green − SWIR1) / (Green + SWIR1)' }, note: { vi: 'Tách nước tốt hơn ở đô thị; Xu 2006', en: 'Better water separation in cities; Xu 2006' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'NDBI', en: 'NDBI' }, f: '(SWIR1 − NIR) / (SWIR1 + NIR)', note: { vi: 'Bề mặt xây dựng; Zha và cs. 2003', en: 'Built-up surfaces; Zha et al. 2003' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'NDMI (NDWI Gao)', en: 'NDMI (Gao NDWI)' }, f: '(NIR − SWIR1) / (NIR + SWIR1)', note: { vi: 'Độ ẩm lá; Gao 1996', en: 'Leaf water; Gao 1996' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'EVI', en: 'EVI' }, f: { vi: '2,5 · (NIR − Đỏ) / (NIR + 6·Đỏ − 7,5·Lam + 1)', en: '2.5 · (NIR − Red) / (NIR + 6·Red − 7.5·Blue + 1)' }, note: { vi: 'Ít bão hòa ở tán dày', en: 'Saturates less over dense canopies' } },
  { cat: 'index', slug: 'ch06-spectral', name: { vi: 'SAVI', en: 'SAVI' }, f: { vi: '(1 + L) · (NIR − Đỏ) / (NIR + Đỏ + L)', en: '(1 + L) · (NIR − Red) / (NIR + Red + L)' }, note: { vi: 'L ≈ 0,5; giảm ảnh hưởng của đất', en: 'L ≈ 0.5; reduces soil influence' } },
  { cat: 'gis', slug: 'ch05-gis', name: { vi: 'Chuyển đổi Helmert 7 tham số (VN-2000 → WGS84)', en: '7-parameter Helmert transformation (VN-2000 → WGS84)' }, f: 'X_WGS84 = T + (1 + s) · R · X_VN2000',
    note: { vi: 'T tịnh tiến, s tỷ lệ, R ma trận xoay', en: 'T translation, s scale, R rotation matrix' } },
  { cat: 'class', slug: 'ch09-classification', name: { vi: 'Phân loại khoảng cách nhỏ nhất', en: 'Minimum-distance classifier' }, f: 'k* = argminₖ ‖x − μₖ‖²', note: { vi: 'μₖ trung bình lớp k', en: 'μₖ mean of class k' } },
  { cat: 'class', slug: 'ch09-classification', name: { vi: 'Phân loại hợp lý cực đại', en: 'Maximum-likelihood classifier' }, f: 'k* = argmaxₖ [ −½ ln|Σₖ| − ½ (x − μₖ)ᵀ Σₖ⁻¹ (x − μₖ) ]', note: { vi: 'Σₖ ma trận hiệp phương sai', en: 'Σₖ covariance matrix' } },
  { cat: 'class', slug: 'ch09-classification', name: { vi: 'Độ chính xác (ước lượng theo diện tích)', en: 'Accuracy (area-weighted estimates)' }, f: 'p̂ᵢⱼ = Wᵢ nᵢⱼ / nᵢ.;  OA = Σⱼ p̂ⱼⱼ;  UAᵢ = p̂ᵢᵢ / p̂ᵢ.;  PAⱼ = p̂ⱼⱼ / p̂.ⱼ',
    note: { vi: 'Wᵢ tỷ lệ diện tích lớp bản đồ i; Olofsson và cs. 2014', en: 'Wᵢ mapped area share of class i; Olofsson et al. 2014' } },
  { cat: 'class', slug: 'ch09-classification', name: { vi: 'Diện tích hiệu chỉnh và sai số chuẩn', en: 'Adjusted area and standard error' }, f: { vi: 'Âⱼ = A Σᵢ p̂ᵢⱼ;  SE(p̂.ⱼ) = √ Σᵢ Wᵢ² (nᵢⱼ/nᵢ.)(1 − nᵢⱼ/nᵢ.) / (nᵢ. − 1);  CI95 = ± 1,96 · A · SE', en: 'Âⱼ = A Σᵢ p̂ᵢⱼ;  SE(p̂.ⱼ) = √ Σᵢ Wᵢ² (nᵢⱼ/nᵢ.)(1 − nᵢⱼ/nᵢ.) / (nᵢ. − 1);  CI95 = ± 1.96 · A · SE' },
    note: { vi: 'A tổng diện tích bản đồ', en: 'A total map area' } },
  { cat: 'sar', slug: 'ch11-sar', name: { vi: 'Decibel', en: 'Decibel' }, f: 'σ⁰(dB) = 10 · log₁₀ σ⁰', note: { vi: 'Lấy trung bình trong công suất tuyến tính, không trong dB', en: 'Average in linear power, not in dB' } },
  { cat: 'sar', slug: 'ch11-sar', name: { vi: 'Độ phân giải cự ly mặt đất', en: 'Ground-range resolution' }, f: 'Δx_mặt đất = Δx_nghiêng / sin θ', note: { vi: 'Sentinel-1 IW: 2,65 m / sin 37° ≈ 4,4 m', en: 'Sentinel-1 IW: 2.65 m / sin 37° ≈ 4.4 m' } },
  { cat: 'sar', slug: 'ch11-sar', name: { vi: 'Bộ lọc Lee', en: 'Lee filter' }, f: "I' = m + W (I − m),  W = max(0, 1 − Cu²/Ci²),  Cu² = 1/ENL,  Ci² = var/m²", note: { vi: 'Sentinel-1 IW GRDH: ENL = 4,4; Lee 1980', en: 'Sentinel-1 IW GRDH: ENL = 4.4; Lee 1980' } },
  { cat: 'sar', slug: 'ch11-sar', name: { vi: 'Méo hình do địa hình', en: 'Terrain distortion' }, f: { vi: 'chồng lấn: sườn trước > θ;  bóng radar: sườn sau > 90° − θ', en: 'layover: fore-slope > θ;  shadow: back-slope > 90° − θ' }, note: { vi: 'θ góc tới', en: 'θ incidence angle' } },
  { cat: 'sar', slug: 'ch11-sar', name: { vi: 'Một vân giao thoa (InSAR)', en: 'One interferometric fringe (InSAR)' }, f: 'Δ(LOS) = λ / 2', note: { vi: 'Sentinel-1: λ/2 ≈ 2,8 cm', en: 'Sentinel-1: λ/2 ≈ 2.8 cm' } },
  { cat: 'dem', slug: 'ch12-dem', name: { vi: 'Đạo hàm Horn (cửa sổ 3×3)', en: 'Horn derivatives (3×3 window)' }, f: '∂z/∂x = [(c + 2f + i) − (a + 2d + g)] / 8r;  ∂z/∂y = [(a + 2b + c) − (g + 2h + i)] / 8r', note: { vi: 'r kích thước pixel', en: 'r pixel size' } },
  { cat: 'dem', slug: 'ch12-dem', name: { vi: 'Độ dốc và bóng đổ địa hình', en: 'Slope and hillshade' }, f: { vi: 'độ dốc = arctan √((∂z/∂x)² + (∂z/∂y)²);  bóng đổ = cos Z cos S + sin Z sin S cos(A − hướng dốc)', en: 'slope = arctan √((∂z/∂x)² + (∂z/∂y)²);  hillshade = cos Z cos S + sin Z sin S cos(A − aspect)' }, note: { vi: 'Z thiên đỉnh, A phương vị Mặt Trời', en: 'Z solar zenith, A solar azimuth' } },
];

const TXT = {
  vi: { search: 'Tìm công thức', all: 'Tất cả', name: 'Tên', formula: 'Công thức', note: 'Ghi chú', ch: 'Chương', n: (k: number, t: number) => `${k}/${t} công thức`, none: 'Không có công thức phù hợp.' },
  en: { search: 'Search formulas', all: 'All', name: 'Name', formula: 'Formula', note: 'Notes', ch: 'Chapter', n: (k: number, t: number) => `${k}/${t} formulas`, none: 'No matching formula.' },
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export default function FormulaTable({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const txt = (f: string | Bi) => (typeof f === 'string' ? f : f[lang]);
  const rows = F_LIST.filter((r) => (cat === 'all' || r.cat === cat)
    && norm(`${r.name[lang]} ${txt(r.f)} ${r.note[lang]} ${CAT[r.cat][lang]}`).includes(norm(q.trim())));
  return (
    <div className="viz">
      <div className="controls">
        <label>{T.search} <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="NDVI, dB, Lee…"
          style={{ minHeight: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--fg)', font: 'inherit' }} /></label>
        <div className="seg" role="group" aria-label={T.ch} style={{ flexWrap: 'wrap' }}>
          <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>{T.all}</button>
          {(Object.keys(CAT) as Cat[]).map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{CAT[c][lang]}</button>)}
        </div>
      </div>
      <p className="muted num" aria-live="polite" style={{ margin: 0, fontSize: '0.85rem' }}>{T.n(rows.length, F_LIST.length)}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{T.name}</th><th>{T.formula}</th><th>{T.note}</th><th>{T.ch}</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={`${r.slug}-${r.name.en}`}>
              <td>{r.name[lang]}</td>
              <td><code style={{ whiteSpace: 'normal' }}>{txt(r.f)}</code></td>
              <td className="muted" style={{ fontSize: '0.85rem' }}>{r.note[lang]}</td>
              <td><a href={url(`${lang}/${r.slug}/`)}>{CHAPTERS.find((c) => c.slug === r.slug)?.n}</a></td>
            </tr>)}
          </tbody>
        </table>
        {!rows.length && <p className="muted">{T.none}</p>}
      </div>
    </div>
  );
}
