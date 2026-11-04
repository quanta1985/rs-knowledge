"""Generate labs/ch10_change.ipynb (Colab).

    cd scripts && python build_lab_ch10.py           # write the notebook
    cd scripts && python build_lab_ch10.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 10 — Phát hiện biến động / Change detection

**Sổ tay Viễn thám & GIS — Chương 10** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch10-change/)

1. Ảnh tổng hợp Landsat 2000 và 2024, hiệu NDVI / Landsat composites 2000 and 2024, NDVI difference.
2. Năm NDVI giảm mạnh nhất cho từng pixel / Year of largest NDVI drop per pixel.
3. Bồi – xói bờ biển Mũi Cà Mau bằng MNDWI / Ca Mau shoreline change with MNDWI."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt
from scipy import ndimage

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Tây Hà Nội 2000 → 2024 / West Hanoi 2000 → 2024"),
    (PY, """OLD = {'red': 'SR_B3', 'nir': 'SR_B4', 'green': 'SR_B2', 'swir1': 'SR_B5'}   # Landsat 5/7
NEW = {'red': 'SR_B4', 'nir': 'SR_B5', 'green': 'SR_B3', 'swir1': 'SR_B6'}   # Landsat 8/9

def landsat(ids, names, geom, start, end):
    def prep(img):
        qa = img.select('QA_PIXEL')
        clear = qa.bitwiseAnd(2).eq(0).And(qa.bitwiseAnd(8).eq(0)).And(qa.bitwiseAnd(16).eq(0))   # bits 1, 3, 4
        return img.select(list(names.values()), list(names.keys())).multiply(0.0000275).add(-0.2).updateMask(clear)
    col = None
    for i in ids:
        c = ee.ImageCollection(i).filterBounds(geom).filterDate(start, end).map(prep)
        col = c if col is None else col.merge(c)
    return col

def composite(geom, year):
    if year <= 2011:
        return landsat(['LANDSAT/LT05/C02/T1_L2', 'LANDSAT/LE07/C02/T1_L2'], OLD, geom, f'{year - 1}-10-01', f'{year + 1}-05-01').median()
    return landsat(['LANDSAT/LC08/C02/T1_L2', 'LANDSAT/LC09/C02/T1_L2'], NEW, geom, f'{year - 1}-10-01', f'{year + 1}-05-01').median()

def pixels(img, x0, y1, n, res=30):
    arr = ee.data.computePixels({'expression': img, 'fileFormat': 'NUMPY_NDARRAY',
        'grid': {'dimensions': {'width': n, 'height': n}, 'crsCode': 'EPSG:32648',
                 'affineTransform': {'scaleX': res, 'shearX': 0, 'translateX': x0, 'shearY': 0, 'scaleY': -res, 'translateY': y1}}})
    return {b: np.asarray(arr[b], float) for b in arr.dtype.names}

X0, Y1, N = 573045, 2330385, 500          # khung Hình 10.1 / Figure 10.1 frame (UTM 48N, 30 m)
geom = ee.Geometry.Rectangle([X0, Y1 - N * 30, X0 + N * 30, Y1], 'EPSG:32648', False)
nd = lambda a, b: (a - b) / (a + b)
y0 = pixels(composite(geom, 2000).select(['red', 'nir']), X0, Y1, N)
y1 = pixels(composite(geom, 2024).select(['red', 'nir']), X0, Y1, N)
v0, v1 = nd(y0['nir'], y0['red']), nd(y1['nir'], y1['red'])
loss = (v0 >= 0.4) & (v1 < 0.25)
print(f'mất thực vật / vegetation loss: {loss.sum() * 900 / 1e6:.2f} km²; trung vị ΔNDVI / median ΔNDVI {np.nanmedian(v1 - v0):+.3f}')
fig, ax = plt.subplots(1, 3, figsize=(16, 5.5), layout='constrained')
ax[0].imshow(v0, cmap='BrBG', vmin=-0.2, vmax=0.8); ax[0].set_title('NDVI 2000')
ax[1].imshow(v1, cmap='BrBG', vmin=-0.2, vmax=0.8); ax[1].set_title('NDVI 2024')
ax[2].imshow(loss, cmap='Oranges'); ax[2].set_title('NDVI ≥ 0.40 → < 0.25')
for a in ax: a.set_axis_off()
plt.show()"""),
    (MD, """## 2. Năm giảm NDVI mạnh nhất / Year of largest NDVI drop

NDVI trung vị mỗi năm, rồi chọn năm có mức giảm so với năm trước lớn nhất (`qualityMosaic`).
Annual median NDVI, then the year with the largest drop from the previous year."""),
    (PY, """sub = ee.Geometry.Rectangle([X0 + 125 * 30, Y1 - 375 * 30, X0 + 375 * 30, Y1 - 125 * 30], 'EPSG:32648', False)
def annual(y):
    ids = (['LANDSAT/LT05/C02/T1_L2', 'LANDSAT/LE07/C02/T1_L2'] if y <= 2012 else []) + \\
          (['LANDSAT/LC08/C02/T1_L2', 'LANDSAT/LC09/C02/T1_L2'] if y >= 2013 else [])
    names = OLD if y <= 2012 else NEW
    col = landsat(ids, {'red': names['red'], 'nir': names['nir']}, sub, f'{y}-01-01', f'{y + 1}-01-01')
    return col.map(lambda i: i.normalizedDifference(['nir', 'red'])).median().rename('ndvi')
years = list(range(2000, 2025))
nd_y = {y: annual(y) for y in years}
drops = ee.ImageCollection([nd_y[y - 1].subtract(nd_y[y]).rename('drop').addBands(ee.Image.constant(y).rename('year').toFloat())
                            for y in years[1:]])
best = drops.qualityMosaic('drop')
px = pixels(best.select(['drop', 'year']), X0 + 125 * 30, Y1 - 125 * 30, 250)
big = px['drop'] > 0.3
yr = np.where(big, px['year'], np.nan)
plt.figure(figsize=(7, 6)); plt.imshow(yr, cmap='viridis', vmin=2001, vmax=2024); plt.colorbar(label='năm / year')
plt.title('Năm NDVI giảm > 0,3 / year of NDVI drop > 0.3'); plt.axis('off'); plt.show()
vals, counts = np.unique(px['year'][big], return_counts=True)
print({int(v): int(c) for v, c in zip(vals, counts)})"""),
    (MD, "## 3. Mũi Cà Mau / Ca Mau cape"),
    (PY, """CX0, CY1 = 466095, 960345            # khung Hình 10.3 / Figure 10.3 frame
cg = ee.Geometry.Rectangle([CX0, CY1 - N * 30, CX0 + N * 30, CY1], 'EPSG:32648', False)
c0 = pixels(composite(cg, 2000).select(['green', 'swir1']), CX0, CY1, N)
c1 = pixels(composite(cg, 2024).select(['green', 'swir1']), CX0, CY1, N)
w0, w1 = nd(c0['green'], c0['swir1']) > 0, nd(c1['green'], c1['swir1']) > 0

def sea(w, min_px=20000):
    lab, _ = ndimage.label(w)
    edge = np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    keep = [l for l in edge if l and (lab == l).sum() >= min_px]
    return np.isin(lab, keep)

s0, s1 = sea(w0), sea(w1)
acc, ero = s0 & ~s1, ~s0 & s1
print(f'bồi / accretion {acc.sum() * 900 / 1e6:.2f} km², xói / erosion {ero.sum() * 900 / 1e6:.2f} km²')
rgb = np.zeros(w0.shape + (3,)); rgb[s0 & s1] = [0.6, 0.75, 0.9]; rgb[acc] = [0, 0.62, 0.45]; rgb[ero] = [0.84, 0.37, 0]
plt.figure(figsize=(7, 7)); plt.imshow(rgb); plt.title('xanh lục = bồi, cam = xói / green = accretion, orange = erosion'); plt.axis('off'); plt.show()"""),
    (MD, """## Bài tập / Exercises

1. Đổi ngưỡng NDVI (0,40 / 0,25) và vẽ diện tích "mất thực vật" theo ngưỡng. / Plot the loss area against the thresholds.
2. Đổi `0.3` trong phần 2 thành `0.2`: năm nào nổi lên? / Change 0.3 to 0.2: which years appear?
3. Đổi khung Cà Mau sang cửa sông Tiền. / Move the Ca Mau frame to the Tien River mouth.

*Landsat courtesy of the U.S. Geological Survey.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch10_change")
