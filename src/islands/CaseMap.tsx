import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { CHAPTERS } from '../data/chapters';
import { url, type Lang } from '../i18n/ui';
import MapStage from './MapStage';
import { StatPanel } from './VizUi';

type Bi = { vi: string; en: string };
type Case = {
  id: string; color: string; title: Bi; place: Bi; period: Bi; data: Bi; method: Bi; result: Bi;
  ch: { slug: string }[]; ours: boolean; shape: [number, number][] | { lon: number; lat: number; km: number } | 'provinces';
};
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;

/** Approximate polygon of a circle (km) on the sphere, for case footprints. */
const circle = (lon: number, lat: number, km: number): [number, number][] =>
  Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * 2 * Math.PI, d = km / 111.32;
    return [lon + (d * Math.cos(a)) / Math.cos((lat * Math.PI) / 180), lat + d * Math.sin(a)];
  });

export const CASES: Case[] = [
  { id: 'yagi', color: '#56B4E9', ours: true, ch: [{ slug: 'ch11-sar' }],
    title: { vi: 'Ngập sau bão Yagi, Hà Nội', en: 'Typhoon Yagi flooding, Hanoi' },
    place: { vi: 'Hồ Tây – sông Hồng (khung 5,12 × 5,12 km)', en: 'West Lake – Red River (5.12 × 5.12 km frame)' },
    period: { vi: '31/08 và 12/09/2024', en: '31 Aug and 12 Sep 2024' },
    data: { vi: 'Sentinel-1A IW GRD, VV, cùng quỹ đạo 91', en: 'Sentinel-1A IW GRD, VV, same orbit 91' },
    method: { vi: 'Lọc Lee 5×5; ngưỡng −15 dB, Otsu, phát hiện thay đổi', en: 'Lee 5×5 filter; −15 dB threshold, Otsu, change detection' },
    result: { vi: 'Nước mới 0,97–2,41 km² tùy phương pháp (chưa kiểm chứng thực địa)', en: 'New water 0.97–2.41 km² depending on the method (not field-validated)' },
    shape: [[105.8085, 21.0782], [105.8577, 21.0780], [105.8575, 21.0317], [105.8082, 21.0320], [105.8085, 21.0782]] },
  { id: 'mekong-flood', color: '#0072B2', ours: false, ch: [{ slug: 'ch11-sar' }],
    title: { vi: 'Lũ mùa ở Đồng bằng sông Cửu Long', en: 'Seasonal floods, Mekong Delta' },
    place: { vi: 'Tứ giác Long Xuyên, Đồng Tháp Mười (vùng gần đúng)', en: 'Long Xuyen Quadrangle, Plain of Reeds (approximate)' },
    period: { vi: 'Mùa lũ khoảng tháng 8–11', en: 'Flood season roughly Aug–Nov' },
    data: { vi: 'Radar (ENVISAT ASAR, nay là Sentinel-1) xuyên mây', en: 'Radar (ENVISAT ASAR, now Sentinel-1), cloud-penetrating' },
    method: { vi: 'Ngưỡng tán xạ ngược thấp của mặt nước, chuỗi nhiều năm', en: 'Low-backscatter water thresholds over multi-year series' },
    result: { vi: 'Bản đồ diện tích và tần suất ngập theo mùa (Kuenzer và cs., 2013)', en: 'Seasonal flood extent and frequency maps (Kuenzer et al., 2013)' },
    shape: [[105.0, 10.95], [105.55, 10.98], [105.95, 10.78], [105.88, 10.38], [105.45, 10.25], [105.05, 10.45], [105.0, 10.95]] },
  { id: 'subsidence', color: '#CC79A7', ours: false, ch: [{ slug: 'ch11-sar' }],
    title: { vi: 'Sụt lún đất (InSAR)', en: 'Land subsidence (InSAR)' },
    place: { vi: 'Đồng bằng sông Cửu Long, gồm TP.HCM, Cần Thơ, Cà Mau', en: 'Mekong Delta incl. Ho Chi Minh City, Can Tho, Ca Mau' },
    period: { vi: 'ALOS PALSAR 2006–2010; Sentinel-1 từ 2015', en: 'ALOS PALSAR 2006–2010; Sentinel-1 since 2015' },
    data: { vi: 'Ảnh radar có pha (SLC), băng L và C', en: 'Phase radar images (SLC), L- and C-band' },
    method: { vi: 'Giao thoa nhiều ảnh (PS-InSAR, SBAS)', en: 'Multi-image interferometry (PS-InSAR, SBAS)' },
    result: { vi: 'Lún trung bình cỡ 1–2 cm/năm, có nơi vài cm/năm; khai thác nước ngầm là nguyên nhân chính (Erban và cs., 2014; Minderhoud và cs., 2017)',
              en: 'Average subsidence of the order of 1–2 cm/yr, locally several cm/yr; groundwater extraction is the main driver (Erban et al., 2014; Minderhoud et al., 2017)' },
    shape: { lon: 105.77, lat: 10.03, km: 30 } },
  { id: 'camau', color: '#009E73', ours: true, ch: [{ slug: 'ch10-change' }],
    title: { vi: 'Bồi và xói bờ biển Mũi Cà Mau', en: 'Coastal accretion and erosion, Ca Mau Cape' },
    place: { vi: 'Mũi Cà Mau (khung 15 × 15 km)', en: 'Ca Mau Cape (15 × 15 km frame)' },
    period: { vi: '2000 → 2024', en: '2000 → 2024' },
    data: { vi: 'Tổng hợp trung vị Landsat 5/7 và 8/9', en: 'Landsat 5/7 and 8/9 median composites' },
    method: { vi: 'MNDWI, tách biển, so sánh hai thời điểm', en: 'MNDWI, sea mask, two-date comparison' },
    result: { vi: 'Bồi 21,09 km², xói 1,01 km² trong khung (Chương 15)', en: '21.09 km² accretion, 1.01 km² erosion in the frame (Chapter 15)' },
    shape: { lon: 104.8, lat: 8.65, km: 9 } },
  { id: 'salinity', color: '#E69F00', ours: false, ch: [{ slug: 'ch06-spectral' }, { slug: 'ch10-change' }],
    title: { vi: 'Hạn hán và xâm nhập mặn', en: 'Drought and saline intrusion' },
    place: { vi: 'Ven biển Bến Tre – Trà Vinh – Sóc Trăng (vùng gần đúng)', en: 'Ben Tre – Tra Vinh – Soc Trang coast (approximate)' },
    period: { vi: 'Mùa khô; các đợt nặng 2015–2016 và 2019–2020', en: 'Dry season; severe events 2015–2016 and 2019–2020' },
    data: { vi: 'NDVI/NDMI (Sentinel-2, MODIS) kết hợp số đo độ mặn tại trạm', en: 'NDVI/NDMI (Sentinel-2, MODIS) with station salinity readings' },
    method: { vi: 'Dị thường chỉ số so với trung bình nhiều năm', en: 'Index anomalies against a multi-year mean' },
    result: { vi: 'Vệ tinh không đo trực tiếp độ mặn của nước: chỉ thấy hậu quả lên cây trồng, nên luôn cần số đo trạm', en: 'Satellites do not measure water salinity directly: they see its effect on crops, so station data are always needed' },
    shape: [[106.2, 10.35], [106.8, 10.0], [106.45, 9.5], [105.95, 9.25], [105.65, 9.55], [106.0, 10.05], [106.2, 10.35]] },
  { id: 'heat', color: '#D55E00', ours: true, ch: [{ slug: 'ch03-physics' }, { slug: 'ch13-vietnam' }],
    title: { vi: 'Đảo nhiệt đô thị TP. Hồ Chí Minh', en: 'Urban heat island, Ho Chi Minh City' },
    place: { vi: 'Khung 40 × 40 km quanh trung tâm', en: '40 × 40 km frame around the centre' },
    period: { vi: 'Mùa khô 01–04/2024', en: 'Dry season Jan–Apr 2024' },
    data: { vi: 'Landsat 8/9 nhiệt (ST_B10), 42 cảnh; ESA WorldCover', en: 'Landsat 8/9 thermal (ST_B10), 42 scenes; ESA WorldCover' },
    method: { vi: 'Trung vị từng pixel sau khi che mây; trung bình theo lớp phủ', en: 'Per-pixel median after cloud masking; mean by land cover' },
    result: { vi: 'Đất xây dựng 40,9 °C, cây gỗ 36,8 °C, mặt nước 32,3 °C (mục 18.3)', en: 'Built-up 40.9 °C, trees 36.8 °C, water 32.3 °C (section 18.3)' },
    shape: [[106.5557, 10.942], [106.9216, 10.9399], [106.9193, 10.5783], [106.5538, 10.5803], [106.5557, 10.942]] },
  { id: 'forest', color: '#F0E442', ours: true, ch: [{ slug: 'ch10-change' }, { slug: 'ch13-vietnam' }],
    title: { vi: 'Mất tán cây ở Tây Nguyên', en: 'Tree-cover loss in the Central Highlands' },
    place: { vi: '5 tỉnh Tây Nguyên (ranh giới trước 2025)', en: '5 Central Highlands provinces (pre-2025 boundaries)' },
    period: { vi: '2001–2025', en: '2001–2025' },
    data: { vi: 'Hansen Global Forest Change v1.13 (Landsat, 30 m)', en: 'Hansen Global Forest Change v1.13 (Landsat, 30 m)' },
    method: { vi: 'Rừng năm 2000 = tán ≥ 30 %; cộng diện tích mất theo năm, theo tỉnh', en: 'Forest 2000 = canopy ≥ 30 %; sum loss area by year and province' },
    result: { vi: 'Mất 709 nghìn ha, 22,5 % diện tích tán cây năm 2000 (mục 18.2)', en: '709 thousand ha lost, 22.5 % of the 2000 tree cover (section 18.2)' },
    shape: 'provinces' },
  { id: 'no2', color: '#F7867A', ours: true, ch: [{ slug: 'ch13-vietnam' }],
    title: { vi: 'Chất lượng không khí: NO₂', en: 'Air quality: NO₂' },
    place: { vi: 'Toàn quốc; so sánh Hà Nội, TP.HCM, Lai Châu', en: 'Nationwide; Hanoi, HCMC, Lai Chau compared' },
    period: { vi: '2019–2024', en: '2019–2024' },
    data: { vi: 'Sentinel-5P TROPOMI, NO₂ tầng đối lưu', en: 'Sentinel-5P TROPOMI, tropospheric NO₂' },
    method: { vi: 'Trung bình năm và theo tháng trong bán kính 10 km', en: 'Annual and monthly means within a 10 km radius' },
    result: { vi: 'Năm 2024: Hà Nội 83,8, TP.HCM 61,9, Lai Châu 20,2 µmol/m² (mục 18.4)', en: '2024: Hanoi 83.8, HCMC 61.9, Lai Chau 20.2 µmol/m² (section 18.4)' },
    shape: { lon: 105.85, lat: 21.03, km: 10 } },
  { id: 'rice', color: '#8FD694', ours: true, ch: [{ slug: 'ch06-spectral' }, { slug: 'ch11-sar' }],
    title: { vi: 'Theo dõi lúa An Giang', en: 'Rice monitoring, An Giang' },
    place: { vi: 'Ô 2 × 2 km ở Tri Tôn', en: '2 × 2 km box at Tri Ton' },
    period: { vi: '2023–2024', en: '2023–2024' },
    data: { vi: 'Sentinel-2 NDVI và Sentinel-1 VH', en: 'Sentinel-2 NDVI and Sentinel-1 VH' },
    method: { vi: 'Chuỗi thời gian; radar lấp khoảng trống mây', en: 'Time series; radar fills the cloud gaps' },
    result: { vi: 'Không có ảnh quang học trong 18/6–16/9/2024; radar vẫn có 6 ảnh', en: 'No optical image 18 Jun–16 Sep 2024; radar still had 6' },
    shape: { lon: 105.08, lat: 10.45, km: 6 } },
];

const TXT = {
  vi: { label: 'Bản đồ các ví dụ viễn thám ở Việt Nam', title: 'Ví dụ', place: 'Địa điểm', period: 'Thời gian', data: 'Dữ liệu', method: 'Phương pháp',
        result: 'Kết quả', ours: 'Nguồn số liệu', yes: 'tính trong sổ tay', no: 'theo tài liệu', learn: 'Học phương pháp ở', ch: 'Chương', pick: 'Bấm một vùng trên bản đồ hoặc chọn bên dưới.' },
  en: { label: 'Map of remote-sensing case studies in Viet Nam', title: 'Case', place: 'Place', period: 'Period', data: 'Data', method: 'Method',
        result: 'Result', ours: 'Numbers', yes: 'computed in this handbook', no: 'from the literature', learn: 'Learn the method in', ch: 'Chapter', pick: 'Click an area on the map or pick below.' },
};

export default function CaseMap({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sel, setSel] = useState('yagi');
  const mapRef = useRef<MlMap | null>(null);
  const c = CASES.find((x) => x.id === sel)!;

  const onMap = (m: MlMap) => {
    mapRef.current = m;
    const features = CASES.filter((k) => k.shape !== 'provinces').map((k) => ({
      type: 'Feature' as const, properties: { id: k.id, color: k.color },
      geometry: { type: 'Polygon' as const, coordinates: [Array.isArray(k.shape) ? k.shape : circle((k.shape as { lon: number }).lon, (k.shape as { lat: number }).lat, (k.shape as { km: number }).km)] },
    }));
    m.addSource('cases', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    fetch(`${DATA}ch13-forest/provinces.json`).then((r) => r.json()).then((geo) => {
      const src = m.getSource('cases') as { setData: (d: unknown) => void } | undefined;
      const forest = CASES.find((k) => k.id === 'forest')!;
      src?.setData({ type: 'FeatureCollection', features: [...features, ...geo.features.map((f: { geometry: unknown }) => ({ type: 'Feature', properties: { id: 'forest', color: forest.color }, geometry: f.geometry }))] });
    }, () => undefined);
    m.addLayer({ id: 'cases-fill', type: 'fill', source: 'cases', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'id'], sel], 0.55, 0.25] } });
    m.addLayer({ id: 'cases-line', type: 'line', source: 'cases', paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'id'], sel], 3, 1.2] } });
    m.on('click', 'cases-fill', (e) => { const id = e.features?.[0]?.properties?.id; if (id) setSel(String(id)); });
    m.on('mouseenter', 'cases-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'cases-fill', () => { m.getCanvas().style.cursor = ''; });
  };

  useEffect(() => { // highlight the selected case
    const m = mapRef.current;
    if (!m?.getLayer('cases-fill')) return;
    m.setPaintProperty('cases-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], sel], 0.55, 0.25]);
    m.setPaintProperty('cases-line', 'line-width', ['case', ['==', ['get', 'id'], sel], 3, 1.2]);
  }, [sel]);

  const hud = (
    <StatPanel title={`${T.title} · ${c.title[lang]}`} rows={[
      { k: T.place, v: c.place[lang] }, { k: T.period, v: c.period[lang] }, { k: T.data, v: c.data[lang] },
      { k: T.method, v: c.method[lang] }, { k: T.result, v: c.result[lang], tone: 'accent' },
      { k: T.ours, v: c.ours ? T.yes : T.no, tone: c.ours ? 'ok' : 'muted' },
    ]}>
      <p style={{ margin: '8px 0 0', fontSize: '0.78rem' }}>{T.learn}{' '}
        {c.ch.map((h, i) => <span key={h.slug}>{i > 0 && ', '}<a href={url(`${lang}/${h.slug}/`)} style={{ color: 'var(--st-accent)' }}>{T.ch} {CHAPTERS.find((x) => x.slug === h.slug)?.n}</a></span>)}
      </p>
    </StatPanel>
  );
  const bar = (
    <div className="ctl" style={{ maxWidth: '100%' }}>
      <span className="ctl-label">{T.pick}</span>
      <div className="pills" role="group" aria-label={T.title}>
        {CASES.map((k) => <button key={k.id} type="button" aria-pressed={sel === k.id} onClick={() => setSel(k.id)}>
          <i aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: k.color, marginRight: 6 }} />{k.title[lang]}</button>)}
      </div>
    </div>
  );
  return <MapStage lang={lang} label={T.label} bounds={[[102, 7.5], [117.5, 23.6]]} hud={hud} bar={bar} height={720} onMap={onMap} />;
}
