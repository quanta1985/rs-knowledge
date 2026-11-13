"""Generate labs/ch11_sar.ipynb (Colab).

    cd scripts && python build_lab_ch11.py           # write the notebook
    cd scripts && python build_lab_ch11.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 16 — Radar Sentinel-1 / Sentinel-1 radar

**Sổ tay Viễn thám & GIS — Chương 16** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch11-sar/)

1. Tải VV, VH cùng khung Hồ Tây / Load VV and VH for the West Lake frame.
2. Lọc speckle (boxcar, Lee) / Filter speckle (boxcar, Lee).
3. Bản đồ ngập sau bão Yagi bằng ngưỡng và phát hiện thay đổi / Yagi flood map by threshold and change detection.
4. Chuỗi VH ruộng lúa An Giang / VH time series of An Giang rice fields."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import uniform_filter

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. VV và VH / VV and VH"),
    (PY, """X0, Y1, N, RES = 583980, 2331020, 512, 10   # cùng khung Chương 9, 11 / same frame as Ch. 9 and 11
FRAME = ee.Geometry.Rectangle([X0, Y1 - N * RES, X0 + N * RES, Y1], 'EPSG:32648', False)

def s1(day, orbit):
    d = ee.Date(day)
    return (ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(FRAME).filterDate(d, d.advance(1, 'day'))
            .filter(ee.Filter.eq('relativeOrbitNumber_start', orbit)).filter(ee.Filter.eq('instrumentMode', 'IW'))
            .mosaic().select(['VV', 'VH']))

def pixels(img):
    arr = ee.data.computePixels({'expression': img, 'fileFormat': 'NUMPY_NDARRAY',
        'grid': {'dimensions': {'width': N, 'height': N}, 'crsCode': 'EPSG:32648',
                 'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': X0, 'shearY': 0, 'scaleY': -RES, 'translateY': Y1}}})
    return {b: arr[b].astype('float32') for b in arr.dtype.names}

ref = pixels(s1('2024-02-12', 128))   # cùng ngày ảnh Sentinel-2 Chương 11 / same day as the Ch. 11 Sentinel-2 scene
fig, ax = plt.subplots(1, 2, figsize=(12, 6), layout='constrained')
for a, b, lim in zip(ax, ['VV', 'VH'], [(-25, 5), (-32, -2)]):
    im = a.imshow(ref[b], cmap='gray', vmin=lim[0], vmax=lim[1]); a.set_title(f'{b} (dB), 2024-02-12'); a.set_axis_off()
    fig.colorbar(im, ax=a, shrink=0.7)
plt.show()"""),
    (MD, """## 2. Lọc speckle / Speckle filtering

Luôn tính trong công suất tuyến tính, không trong dB. / Always compute in linear power, not dB."""),
    (PY, """lin = lambda db: 10 ** (db / 10)
db = lambda p: 10 * np.log10(p)

def boxcar(v, k):
    return db(uniform_filter(lin(v), k))

def lee(v, k, enl=4.4):
    p = lin(v); m = uniform_filter(p, k); var = np.maximum(uniform_filter(p * p, k) - m * m, 0)
    ci2 = var / np.maximum(m * m, 1e-12); w = np.clip(1 - (1 / enl) / np.maximum(ci2, 1e-12), 0, 1)
    return db(m + w * (p - m))

lake = (slice(290, 310), slice(150, 170))   # cửa sổ giữa Hồ Tây / window inside West Lake
for name, v in [('raw', ref['VV']), ('boxcar 5', boxcar(ref['VV'], 5)), ('Lee 5', lee(ref['VV'], 5)), ('boxcar 9', boxcar(ref['VV'], 9))]:
    print(f'{name:9s} SD trong hồ / in lake = {v[lake].std():.2f} dB')

zoom = (slice(200, 330), slice(220, 350))   # bờ hồ / lake shore
fig, ax = plt.subplots(1, 3, figsize=(15, 5), layout='constrained')
for a, (t, v) in zip(ax, [('raw', ref['VV']), ('boxcar 9x9', boxcar(ref['VV'], 9)), ('Lee 9x9', lee(ref['VV'], 9))]):
    a.imshow(v[zoom], cmap='gray', vmin=-25, vmax=5); a.set_title(t); a.set_axis_off()
plt.show()"""),
    (MD, """## 3. Bão Yagi / Typhoon Yagi

Hai ảnh cùng quỹ đạo 91 (xuống), cách nhau 12 ngày. / Two images from the same orbit 91 (descending), 12 days apart."""),
    (PY, """pre = lee(pixels(s1('2024-08-31', 91))['VV'], 5)
post = lee(pixels(s1('2024-09-12', 91))['VV'], 5)
T, DROP = -15, -3
water_before = pre < T
new_thr = ~water_before & (post < T)
new_diff = ~water_before & (post - pre < DROP)
km2 = lambda m: m.sum() * RES ** 2 / 1e6
print(f'nước trước / water before: {km2(water_before):.2f} km²')
print(f'nước mới, ngưỡng / new water, threshold: {km2(new_thr):.2f} km²')
print(f'nước mới, thay đổi / new water, change: {km2(new_diff):.2f} km²')

fig, ax = plt.subplots(1, 3, figsize=(16, 5.5), layout='constrained')
ax[0].imshow(post - pre, cmap='RdBu', vmin=-10, vmax=10); ax[0].set_title('VV sau − trước / after − before (dB)')
for a, m, t in [(ax[1], new_thr, 'ngưỡng / threshold'), (ax[2], new_diff, 'thay đổi / change')]:
    rgb = np.dstack([np.clip((post + 25) / 30, 0, 1)] * 3)
    rgb[water_before] = [0, 0.45, 0.7]; rgb[m] = [0.9, 0.62, 0]
    a.imshow(rgb); a.set_title(f'{t}: {km2(m):.2f} km²')
for a in ax: a.set_axis_off()
plt.show()"""),
    (MD, "## 4. Lúa An Giang / An Giang rice"),
    (PY, """box = ee.Geometry.Point([105.08, 10.45]).buffer(1000).bounds()
crop = ee.ImageCollection('ESA/WorldCover/v200').first().eq(40)
col = (ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(box).filterDate('2023-01-01', '2025-01-01')
       .filter(ee.Filter.eq('instrumentMode', 'IW')).filter(ee.Filter.eq('relativeOrbitNumber_start', 26)))

def mean_db(img):
    p = ee.Image(10).pow(img.select('VH').divide(10)).rename('VH').updateMask(crop)   # trung bình theo công suất / mean in power
    return ee.Feature(None, {'date': img.date().format('YYYY-MM-dd'), 'vh': p.reduceRegion(ee.Reducer.mean(), box, 10).get('VH')})

rows = sorted((f['properties'] for f in ee.FeatureCollection(col.map(mean_db)).getInfo()['features'] if f['properties'].get('vh')),
              key=lambda r: r['date'])
dates = np.array([np.datetime64(r['date']) for r in rows]); vh = 10 * np.log10([r['vh'] for r in rows])
plt.figure(figsize=(11, 3.5)); plt.plot(dates, vh, 's-', color='#0072B2')
plt.ylabel('VH σ⁰ (dB)'); plt.title('An Giang, Sentinel-1 orbit 26'); plt.grid(alpha=.3); plt.show()
print(len(rows), 'ảnh / images')"""),
    (MD, """## Bài tập / Exercises

1. Đổi `FRAME` sang vùng núi ngập sau bão Yagi (Lào Cai, Yên Bái). Ngưỡng −15 dB còn đúng không? / Move to a flooded mountain area: does −15 dB still work?
2. Đếm số vụ lúa năm 2024 từ chuỗi VH. / Count the 2024 rice crops from the VH series.
3. Thử `DROP = -2` và `-5`. Diện tích nước mới thay đổi bao nhiêu? / Try other DROP values.

*Contains modified Copernicus Sentinel data 2023–2024.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch11_sar")
