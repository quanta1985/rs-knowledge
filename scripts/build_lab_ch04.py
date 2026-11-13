"""Generate labs/ch04_resolution.ipynb (Colab).

    python scripts/build_lab_ch04.py           # write the notebook
    python scripts/build_lab_ch04.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 9 — Bốn loại độ phân giải / The four resolutions

**Sổ tay Viễn thám & GIS — Chương 9** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch04-resolution/)

1. Tải cùng khung Hồ Tây từ Sentinel-2 (10 m), Landsat 9 (30 m), MODIS (250 m, 500 m) / Load the same West Lake frame from four products.
2. So sánh diện tích NDVI < 0 / Compare the NDVI < 0 area.
3. Mô phỏng gộp pixel và tính ngưỡng pixel hỗn hợp / Simulate aggregation and the mixed-pixel threshold.
4. Đếm ảnh không mây theo tháng cho một điểm bất kỳ / Count cloud-free images per month for any point."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Bốn sản phẩm, cùng một khung / Four products, one frame"),
    (PY, """X0, Y1, EXTENT = 583980, 2331020, 5120   # góc trên-trái UTM 48N / upper-left corner, frame size (m)

def grid_pixels(image, res):
    n = -(-EXTENT // res)  # làm tròn lên / ceil
    arr = ee.data.computePixels({
        'expression': image, 'fileFormat': 'NUMPY_NDARRAY',
        'grid': {'dimensions': {'width': n, 'height': n},
                 'affineTransform': {'scaleX': res, 'shearX': 0, 'translateX': X0,
                                     'shearY': 0, 'scaleY': -res, 'translateY': Y1},
                 'crsCode': 'EPSG:32648'}})
    return {b: arr[b].astype('float32') for b in arr.dtype.names}

s2 = grid_pixels(ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ')
                 .select(['B4', 'B8'], ['red', 'nir']).divide(10000), 10)
l9 = grid_pixels(ee.Image('LANDSAT/LC09/C02/T1_L2/LC09_127045_20231222')
                 .select(['SR_B4', 'SR_B5'], ['red', 'nir']).multiply(0.0000275).add(-0.2), 30)
m250 = grid_pixels(ee.Image('MODIS/061/MOD09GQ/2023_12_07')
                   .select(['sur_refl_b01', 'sur_refl_b02'], ['red', 'nir']).multiply(0.0001), 250)
m500 = grid_pixels(ee.Image('MODIS/061/MOD09GA/2023_12_07')
                   .select(['sur_refl_b01', 'sur_refl_b02'], ['red', 'nir']).multiply(0.0001), 500)
PRODUCTS = {'Sentinel-2 10 m': (s2, 10), 'Landsat 9 30 m': (l9, 30), 'MODIS 250 m': (m250, 250), 'MODIS 500 m': (m500, 500)}"""),
    (PY, """def on_10m_grid(v, res, n=512):
    idx = (np.arange(n) * 10 // res).astype(int)   # láng giềng gần nhất / nearest neighbour
    return v[np.ix_(idx, idx)]

fig, ax = plt.subplots(1, 4, figsize=(16, 4.5), layout='constrained')
for a, (name, (d, res)) in zip(ax, PRODUCTS.items()):
    ndvi = (d['nir'] - d['red']) / (d['nir'] + d['red'])
    water_km2 = (on_10m_grid(ndvi, res) < 0).sum() * 100 / 1e6
    a.imshow(ndvi, cmap='BrBG', vmin=-1, vmax=1, interpolation='nearest')
    a.set_title(f'{name}\\nNDVI < 0: {water_km2:.2f} km²'); a.set_axis_off()
    print(f'{name:16s} {ndvi.shape[0]:3d}x{ndvi.shape[1]:<3d} px   NDVI<0 = {water_km2:.2f} km²')
plt.show()"""),
    (MD, """## 2. Gộp pixel trên cùng một ảnh / Aggregating one image

Lấy trung bình phản xạ trước, tính NDVI sau, giống như cảm biến thô hơn thực sự đo.
Average reflectance first, then compute NDVI, as a coarser sensor would actually measure."""),
    (PY, """def block_mean(v, f):
    n = v.shape[0] // f * f
    return v[:n, :n].reshape(n // f, f, n // f, f).mean(axis=(1, 3))

sizes, areas = [], []
for f in [1, 2, 4, 8, 16, 32, 64]:
    r, n = block_mean(s2['red'], f), block_mean(s2['nir'], f)
    ndvi = (n - r) / (n + r)
    sizes.append(10 * f); areas.append((ndvi < 0).sum() * (10 * f) ** 2 / 1e6)
    print(f'{10 * f:4d} m  NDVI<0 = {areas[-1]:.2f} km²')

plt.figure(figsize=(6, 3.5))
plt.semilogx(sizes, areas, 'o-', base=2)
plt.xticks(sizes, sizes); plt.xlabel('Kích thước pixel / pixel size (m)'); plt.ylabel('km²')
plt.title('Diện tích NDVI < 0 / Area with NDVI < 0'); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 3. Ngưỡng pixel hỗn hợp / Mixed-pixel threshold

ρ(pixel) = f · ρ(nước) + (1 − f) · ρ(thực vật). NDVI < 0 khi NIR < Đỏ / when NIR < Red."""),
    (PY, """water = {'red': 0.038, 'nir': 0.031}   # Hồ Tây, 3x3 px (Chương 11)
veg = {'red': 0.033, 'nir': 0.431}     # thực vật bãi bồi / floodplain vegetation
dA, dB = water['nir'] - water['red'], veg['nir'] - veg['red']
f_star = dB / (dB - dA)
print(f'NDVI < 0 khi tỷ lệ nước f > {f_star:.3f}  ({f_star:.1%})')
for f in [0.5, 0.9, 0.99]:
    r = f * water['red'] + (1 - f) * veg['red']; n = f * water['nir'] + (1 - f) * veg['nir']
    print(f'f = {f:.2f}:  NDVI = {(n - r) / (n + r):+.3f}')"""),
    (MD, """## 4. Ảnh dùng được theo tháng / Usable images per month

Đổi `POINT` sang nơi bạn quan tâm. / Change `POINT` to your place of interest."""),
    (PY, """POINT = (105.833, 21.055)   # Hồ Tây; thử / try (105.08, 10.45) An Giang
box = ee.Geometry.Point(POINT).buffer(1000).bounds()
col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(box).filterDate('2022-01-01', '2025-01-01')
       .linkCollection(ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED'), ['cs_cdf']))
fc = col.map(lambda img: ee.Feature(None, {
    'date': img.date().format('YYYY-MM-dd'),
    'clear': img.select('cs_cdf').gte(0.6).reduceRegion(ee.Reducer.mean(), box, 20).get('cs_cdf')}))
rows = [f['properties'] for f in fc.getInfo()['features'] if f['properties'].get('clear') is not None]
best = {}
for r in rows:
    best[r['date']] = max(best.get(r['date'], 0), r['clear'])   # gộp tile cùng ngày / merge same-day tiles
months = np.array([int(d[5:7]) for d in best]); clear = np.array(list(best.values()))
years = 3
acq = [np.sum(months == m) / years for m in range(1, 13)]
ok = [np.sum((months == m) & (clear >= 0.9)) / years for m in range(1, 13)]
plt.figure(figsize=(8, 3.5))
plt.bar(range(1, 13), acq, color='0.85', label='Số lần chụp / acquisitions')
plt.bar(range(1, 13), ok, color='#0072B2', label='Dùng được (≥ 90 % không mây) / usable')
plt.xticks(range(1, 13)); plt.xlabel('Tháng / month'); plt.ylabel('Ảnh / năm / images per year')
plt.legend(); plt.title(f'Sentinel-2 2022–2024 tại {POINT}'); plt.show()
print('usable dates:', int(np.sum(clear >= 0.9)), '/', len(best))"""),
    (MD, """## Bài tập / Exercises

1. Đổi `POINT` sang quê bạn. Tháng nào khó có ảnh nhất? / Your home town: which month is hardest?
2. Đo một hồ nhỏ (< 0,5 km²) bằng Sentinel-2 và Landsat. Sai khác bao nhiêu %? / Measure a small lake with both.
3. Thay thực vật bằng mái nhà (Đỏ 0,120; NIR 0,136): ngưỡng f* là bao nhiêu? / Replace vegetation by roofs: what is f*?

*Contains modified Copernicus Sentinel data; Landsat courtesy of USGS; MODIS courtesy of NASA LP DAAC.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch04_resolution")
