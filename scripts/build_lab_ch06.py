"""Generate labs/ch06_spectral_indices.ipynb (Colab) from the cell list below.

    python scripts/build_lab_ch06.py           # write the notebook
    python scripts/build_lab_ch06.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 11 — Chỉ số phổ trên ảnh Sentinel-2 Hà Nội / Spectral indices on a Sentinel-2 image of Hanoi

**Sổ tay Viễn thám & GIS — Chương 11** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch06-spectral/)

Mục tiêu / Goals:
1. Tải đúng cảnh Sentinel-2 L2A ngày 12/02/2024 dùng trong sổ tay / Load the exact Sentinel-2 L2A scene used in the handbook.
2. Hiển thị tổ hợp màu với kéo giãn 2–98 % / Display composites with a 2–98 % stretch.
3. Tính NDVI, NDWI, MNDWI, NDBI / Compute NDVI, NDWI, MNDWI, NDBI.
4. Chọn ngưỡng Otsu và tính diện tích mặt nước / Pick an Otsu threshold and measure water area.

Cần tài khoản Google Earth Engine và một Cloud project đã bật Earth Engine API.
You need a Google Earth Engine account and a Cloud project with the Earth Engine API enabled."""),
    (PY, """# Colab đã có sẵn các thư viện này / these are preinstalled on Colab
import ee
import numpy as np
import matplotlib.pyplot as plt
from skimage.filters import threshold_otsu

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, """## 1. Tải dữ liệu / Load the data

Lưới 512 × 512 pixel, 10 m, hệ UTM 48N, giống hệt dữ liệu trong sổ tay. Các kênh 20 m được lấy mẫu lại về 10 m (láng giềng gần nhất).
A 512 × 512 pixel, 10 m UTM 48N grid, identical to the handbook data. 20 m bands are resampled to 10 m (nearest neighbour)."""),
    (PY, """SCENE = 'COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ'
BANDS = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12']
X0, Y1, N, RES = 583980, 2331020, 512, 10  # upper-left corner (m), size, pixel size

img = ee.Image(SCENE).select(BANDS)
arr = ee.data.computePixels({
    'expression': img,
    'fileFormat': 'NUMPY_NDARRAY',
    'grid': {'dimensions': {'width': N, 'height': N},
             'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': X0,
                                 'shearY': 0, 'scaleY': -RES, 'translateY': Y1},
             'crsCode': 'EPSG:32648'},
})
# DN -> phản xạ / reflectance (S2_SR_HARMONIZED: chỉ cần chia 10 000 / just divide by 10 000)
R = {b: arr[b].astype('float32') / 10000 for b in BANDS}
print({b: round(float(R[b].mean()), 4) for b in BANDS})"""),
    (MD, "## 2. Tổ hợp màu / Colour composites"),
    (PY, """def stretch(x, lo=2, hi=98):
    a, b = np.percentile(x, [lo, hi])
    return np.clip((x - a) / (b - a), 0, 1)

def rgb(r, g, b):
    return np.dstack([stretch(R[r]), stretch(R[g]), stretch(R[b])])

fig, ax = plt.subplots(1, 2, figsize=(12, 6), layout='constrained')
ax[0].imshow(rgb('B4', 'B3', 'B2')); ax[0].set_title('Màu thật / True colour (B4-B3-B2)')
ax[1].imshow(rgb('B8', 'B4', 'B3')); ax[1].set_title('Hồng ngoại giả / False colour (B8-B4-B3)')
for a in ax: a.set_axis_off()
fig.suptitle('Sentinel-2B L2A, 2024-02-12 — kéo giãn 2–98 % / 2–98 % stretch')
plt.show()"""),
    (MD, """## 3. Chỉ số chênh lệch chuẩn hóa / Normalized-difference indices

Thang màu cố định −1…+1 cho mọi chỉ số để so sánh được. / Fixed −1…+1 scale for every index so they are comparable."""),
    (PY, """def nd(a, b):
    return (R[a] - R[b]) / (R[a] + R[b])

IDX = {'NDVI': nd('B8', 'B4'), 'NDWI': nd('B3', 'B8'), 'MNDWI': nd('B3', 'B11'), 'NDBI': nd('B11', 'B8')}

fig, ax = plt.subplots(2, 2, figsize=(11, 10), layout='constrained')
for a, (name, v) in zip(ax.flat, IDX.items()):
    im = a.imshow(v, cmap='BrBG', vmin=-1, vmax=1, interpolation='nearest')
    a.set_title(name); a.set_axis_off()
fig.colorbar(im, ax=ax, shrink=0.6, label='Giá trị chỉ số / index value')
plt.show()

# Ví dụ tính tay / worked example: pixel thực vật bãi bồi (hàng 323, cột 422)
r, c = 323, 422
w = (slice(r - 1, r + 2), slice(c - 1, c + 2))
b8, b4 = R['B8'][w].mean(), R['B4'][w].mean()
print(f'B8={b8:.4f}  B4={b4:.4f}  NDVI={(b8 - b4) / (b8 + b4):.3f}')"""),
    (MD, "## 4. Histogram, ngưỡng Otsu và diện tích / Histogram, Otsu threshold and area"),
    (PY, """PIX_KM2 = RES * RES / 1e6
fig, ax = plt.subplots(1, 3, figsize=(15, 4), layout='constrained')
for a, name in zip(ax, ['NDWI', 'MNDWI', 'NDVI']):
    v = IDX[name].ravel()
    t = threshold_otsu(v)
    a.hist(v, bins=100, range=(-1, 1), color='0.6')
    a.axvline(t, color='k', lw=1.5, label=f'Otsu = {t:.2f}')
    a.axvline(0.4, color='tab:orange', ls='--', label='0.40')
    a.set(title=name, xlabel='Giá trị / value', ylabel='Số pixel / pixels')
    a.legend()
    print(f'{name:6s} Otsu={t:+.2f} -> {(v >= t).sum() * PIX_KM2:5.2f} km²   |   >=0.40 -> {(v >= 0.4).sum() * PIX_KM2:5.2f} km²')
plt.show()"""),
    (PY, """# So sánh mặt nạ nước / compare water masks at a 0.40 threshold
fig, ax = plt.subplots(1, 2, figsize=(12, 6), layout='constrained')
for a, name in zip(ax, ['NDWI', 'MNDWI']):
    a.imshow(stretch(R['B4']), cmap='gray')
    a.imshow(np.ma.masked_less(IDX[name], 0.4), cmap='winter', vmin=0, vmax=1)
    a.set_title(f'{name} ≥ 0,40'); a.set_axis_off()
plt.show()"""),
    (MD, """## 5. Bài tập / Exercises

1. Lặp lại với một cảnh mùa mưa (tháng 9–10). Diện tích mặt nước sông Hồng thay đổi thế nào?
   Repeat with a wet-season scene (Sep–Oct). How does the Red River water area change?
   *Gợi ý / hint:* `ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(...).filterDate('2024-09-01', '2024-11-01').sort('CLOUDY_PIXEL_PERCENTAGE')`
2. Chọn 5 pixel đô thị và 5 pixel đất trống; tìm tổ hợp hai kênh tách chúng tốt hơn NDBI.
   Pick 5 built-up and 5 bare-soil pixels; find a band pair that separates them better than NDBI.
3. Tính EVI = 2,5·(NIR − Red)/(NIR + 6·Red − 7,5·Blue + 1) và so sánh với NDVI trên bãi bồi.
   Compute EVI and compare it with NDVI over the floodplain.

*Dữ liệu: chứa dữ liệu Copernicus Sentinel đã xử lý (2024). / Contains modified Copernicus Sentinel data (2024).*"""),
]



if __name__ == "__main__":
    main(CELLS, "ch06_spectral_indices")
