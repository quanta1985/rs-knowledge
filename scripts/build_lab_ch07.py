"""Generate labs/ch07_preprocessing.ipynb (Colab).

    cd scripts && python build_lab_ch07.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 12 — Tiền xử lý / Pre-processing

**Sổ tay Viễn thám & GIS — Chương 12** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch07-preprocessing/)

1. DN → phản xạ TOA → bức xạ từ metadata / DN → TOA reflectance → radiance from metadata.
2. L1C so với L2A / L1C versus L2A.
3. Lọc mây Cloud Score+ / Cloud Score+ masking.
4. Ảnh tổng hợp trung vị / Median composite."""),
    (PY, """import ee, math
import numpy as np
import matplotlib.pyplot as plt

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)

X0, Y1, N, RES = 583980, 2331020, 512, 10   # khung Hồ Tây / West Lake frame
FRAME = ee.Geometry.Rectangle([X0, Y1 - N * RES, X0 + N * RES, Y1], 'EPSG:32648', False)
def pixels(img, bands):
    arr = ee.data.computePixels({'expression': img.select(bands), 'fileFormat': 'NUMPY_NDARRAY',
        'grid': {'dimensions': {'width': N, 'height': N}, 'crsCode': 'EPSG:32648',
                 'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': X0, 'shearY': 0, 'scaleY': -RES, 'translateY': Y1}}})
    return {b: arr[b].astype('float64') for b in bands}"""),
    (MD, "## 1. Metadata và bức xạ / Metadata and radiance"),
    (PY, """SCENE = '20240212T032849_20240212T033821_T48QWJ'
l1c = ee.Image('COPERNICUS/S2_HARMONIZED/' + SCENE)
meta = l1c.toDictionary(['MEAN_SOLAR_ZENITH_ANGLE', 'REFLECTANCE_CONVERSION_CORRECTION', 'SOLAR_IRRADIANCE_B2', 'RADIO_ADD_OFFSET_B2']).getInfo()
print(meta)
toa = pixels(l1c, ['B2', 'B3', 'B4', 'B8'])
sr = pixels(ee.Image('COPERNICUS/S2_SR_HARMONIZED/' + SCENE), ['B2', 'B3', 'B4', 'B8'])
r, c = 300, 160                                   # Hồ Tây / West Lake
rho = toa['B2'][r-1:r+2, c-1:c+2].mean() / 1e4    # bộ HARMONIZED đã trừ offset / offset already removed
L = rho * meta['REFLECTANCE_CONVERSION_CORRECTION'] * meta['SOLAR_IRRADIANCE_B2'] * math.cos(math.radians(meta['MEAN_SOLAR_ZENITH_ANGLE'])) / math.pi
print(f'DN gốc / raw DN = {rho * 1e4 - meta["RADIO_ADD_OFFSET_B2"]:.0f}, rho_TOA = {rho:.4f}, L = {L:.2f} W m-2 sr-1 um-1')
print(f'rho_SR = {sr["B2"][r-1:r+2, c-1:c+2].mean() / 1e4:.4f}')"""),
    (MD, "## 2. TOA − mặt đất theo kênh / TOA − surface by band"),
    (PY, """diff = {b: (toa[b] - sr[b]).mean() / 1e4 for b in toa}
print({b: round(v, 4) for b, v in diff.items()})
fig, ax = plt.subplots(1, 3, figsize=(16, 5.5), layout='constrained')
rgb = lambda d: np.clip(np.dstack([d['B4'], d['B3'], d['B2']]) / 2500, 0, 1)   # cùng kéo giãn / same stretch
ax[0].imshow(rgb(toa)); ax[0].set_title('L1C TOA')
ax[1].imshow(rgb(sr)); ax[1].set_title('L2A surface')
ax[2].bar(list(diff), list(diff.values()), color=['#0072B2', '#009E73', '#D55E00', '#CC79A7']); ax[2].axhline(0, color='k')
ax[2].set_title('TOA − surface (mean)')
for a in ax[:2]: a.set_axis_off()
plt.show()"""),
    (MD, "## 3. Lọc mây / Cloud masking (05/10/2023)"),
    (PY, """cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED')
cloudy = ee.Image(ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(FRAME).filterDate('2023-10-05', '2023-10-06')
                  .linkCollection(cs, ['cs_cdf']).first())
d = pixels(cloudy, ['B2', 'B3', 'B4', 'cs_cdf', 'SCL'])
scl_bad = np.isin(d['SCL'], [3, 8, 9, 10])
for t in [0.4, 0.5, 0.6, 0.7, 0.8]:
    print(f'cs_cdf >= {t}: giữ / kept {100 * (d["cs_cdf"] >= t).mean():.1f} %')
print(f'SCL giữ / kept {100 * (~scl_bad).mean():.1f} %, trùng / agreement {100 * ((d["cs_cdf"] < 0.6) == scl_bad).mean():.1f} %')
fig, ax = plt.subplots(1, 3, figsize=(16, 5.5), layout='constrained')
ax[0].imshow(np.clip(np.dstack([d['B4'], d['B3'], d['B2']]) / 3000, 0, 1)); ax[0].set_title('2023-10-05')
ax[1].imshow(d['cs_cdf'], cmap='viridis', vmin=0, vmax=1); ax[1].set_title('cs_cdf')
ax[2].imshow(scl_bad, cmap='gray'); ax[2].set_title('SCL 3/8/9/10')
for a in ax: a.set_axis_off()
plt.show()"""),
    (MD, "## 4. Ảnh tổng hợp / Composite"),
    (PY, """col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(FRAME).filterDate('2023-08-21', '2023-11-20')
       .linkCollection(cs, ['cs_cdf']))
raw = pixels(col.select(['B2', 'B3', 'B4']).median(), ['B2', 'B3', 'B4'])
masked = pixels(col.map(lambda i: i.updateMask(i.select('cs_cdf').gte(0.6))).select(['B2', 'B3', 'B4']).median().unmask(0), ['B2', 'B3', 'B4'])
vis = lambda d: (d['B2'] + d['B3'] + d['B4']) / 3 / 1e4
print(col.size().getInfo(), 'ảnh / images')
print(f'pixel sáng như mây / cloud-bright: không lọc / unmasked {100 * (vis(raw) > 0.2).mean():.1f} %, lọc / masked {100 * (vis(masked) > 0.2).mean():.1f} %')
fig, ax = plt.subplots(1, 2, figsize=(12, 6), layout='constrained')
for a, (t, d) in zip(ax, [('median raw', raw), ('median, cs_cdf >= 0.6', masked)]):
    a.imshow(np.clip(np.dstack([d['B4'], d['B3'], d['B2']]) / 3000, 0, 1)); a.set_title(t); a.set_axis_off()
plt.show()"""),
    (MD, """## Bài tập / Exercises

1. Đổi `SCENE` sang một ảnh tháng 7: hệ số U thay đổi thế nào? / Use a July scene: how does U change?
2. Thử ngưỡng 0,5 và 0,7 cho ảnh tổng hợp. / Try thresholds 0.5 and 0.7 for the composite.

*Contains modified Copernicus Sentinel data 2023–2024.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch07_preprocessing")
