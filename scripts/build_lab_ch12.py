"""Generate labs/ch12_dem.ipynb (Colab).

    cd scripts && python build_lab_ch12.py           # write the notebook
    cd scripts && python build_lab_ch12.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 12 — Mô hình số độ cao / Elevation models

**Sổ tay Viễn thám & GIS — Chương 12** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch12-dem/)

1. Tải Copernicus GLO-30 và SRTM cùng khung Fansipan / Load Copernicus GLO-30 and SRTM on one Fansipan grid.
2. Độ dốc, bóng đổ, hiệu hai DEM / Slope, hillshade, DEM difference.
3. Mặt cắt địa hình / Terrain profile.
4. Chồng lấn và bóng radar Sentinel-1 / Sentinel-1 layover and shadow."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Hai DEM trên cùng lưới / Two DEMs on one grid"),
    (PY, """N, RES = 600, 30
X0, Y1 = 377_000 - N * RES // 2, 2_469_000 + N * RES // 2     # UTM 48N, quanh Fansipan / around Fansipan
col = ee.ImageCollection('COPERNICUS/DEM/GLO30_2024_1').filterBounds(ee.Geometry.Point(103.775, 22.3033).buffer(20_000))
cop = col.select('DEM').mosaic().setDefaultProjection(col.first().projection()).resample('bilinear').rename('cop')  # mosaic() mất phép chiếu gốc / mosaic() drops the native projection
srtm = ee.Image('USGS/SRTMGL1_003').select('elevation').resample('bilinear').rename('srtm')
arr = ee.data.computePixels({'expression': ee.Image.cat([cop, srtm]), 'fileFormat': 'NUMPY_NDARRAY',
    'grid': {'dimensions': {'width': N, 'height': N}, 'crsCode': 'EPSG:32648',
             'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': X0, 'shearY': 0, 'scaleY': -RES, 'translateY': Y1}}})
Z, S = arr['cop'].round(), arr['srtm'].round()   # làm tròn tới mét như dữ liệu sổ tay / whole metres, as in the handbook data
print(f'Copernicus {Z.min():.0f}–{Z.max():.0f} m, SRTM {S.min():.0f}–{S.max():.0f} m')"""),
    (MD, """## 2. Độ dốc, bóng đổ / Slope, hillshade (Horn 1981)"""),
    (PY, """def slope_aspect(z, res):
    p = np.pad(z, 1, mode='edge')
    a, b, c = p[:-2, :-2], p[:-2, 1:-1], p[:-2, 2:]
    d, f = p[1:-1, :-2], p[1:-1, 2:]
    g, h, i = p[2:, :-2], p[2:, 1:-1], p[2:, 2:]
    east = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * res)
    north = ((a + 2 * b + c) - (g + 2 * h + i)) / (8 * res)
    return np.degrees(np.arctan(np.hypot(east, north))), (np.degrees(np.arctan2(-east, -north)) + 360) % 360

def hillshade(slope, aspect, az=315, el=45):
    zen, s = np.radians(90 - el), np.radians(slope)
    return np.clip(np.cos(zen) * np.cos(s) + np.sin(zen) * np.sin(s) * np.cos(np.radians(az - aspect)), 0, 1)

slope, aspect = slope_aspect(Z, RES)
d = Z - S
print(f'dốc > 30°: {(slope > 30).mean():.1%}   Cop − SRTM: {d.mean():.2f} ± {d.std():.2f} m, |Δ| > 10 m: {(abs(d) > 10).mean():.1%}')
fig, ax = plt.subplots(1, 3, figsize=(16, 5.5), layout='constrained')
ax[0].imshow(hillshade(slope, aspect), cmap='gray'); ax[0].set_title('Bóng đổ / hillshade (315°, 45°)')
im = ax[1].imshow(slope, cmap='viridis', vmin=0, vmax=60); ax[1].set_title('Độ dốc / slope (°)'); fig.colorbar(im, ax=ax[1], shrink=.7)
im = ax[2].imshow(d, cmap='BrBG', vmin=-30, vmax=30); ax[2].set_title('Copernicus − SRTM (m)'); fig.colorbar(im, ax=ax[2], shrink=.7)
for a in ax: a.set_axis_off()
plt.show()"""),
    (MD, "## 3. Mặt cắt / Profile"),
    (PY, """from scipy.ndimage import map_coordinates
A, B = (369, 193), (250, 431)    # (hàng, cột) đỉnh Fansipan → Sa Pa / (row, col) summit → Sa Pa
t = np.linspace(0, 1, 240)
rows, cols = A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t
dist = np.hypot(B[0] - A[0], B[1] - A[1]) * RES * t / 1000
pc, ps = map_coordinates(Z, [rows, cols], order=1), map_coordinates(S, [rows, cols], order=1)
print(f'dài / length {dist[-1]:.2f} km, {pc[0]:.0f} → {pc[-1]:.0f} m, thấp nhất / lowest {pc.min():.0f} m, leo / ascent {np.clip(np.diff(pc), 0, None).sum():.0f} m')
plt.figure(figsize=(10, 3.5)); plt.plot(dist, pc, label='Copernicus'); plt.plot(dist, ps, '--', label='SRTM')
plt.xlabel('km'); plt.ylabel('m'); plt.legend(); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 4. Chồng lấn và bóng radar / Layover and shadow

Chỉ thành phần độ dốc theo hướng nhìn radar mới quan trọng. / Only the slope component along the look direction matters."""),
    (PY, """def radar_effect(slope, aspect, theta, look_az):
    ar = np.degrees(np.arctan(np.tan(np.radians(slope)) * np.cos(np.radians(aspect - look_az - 180))))
    return np.where(ar >= theta, 2, np.where(-ar > 90 - theta, 3, np.where(ar > 0, 1, 0)))   # 1 co ngắn, 2 chồng lấn, 3 bóng

for name, look in [('ASC', 77.6), ('DESC', 282.4)]:   # hướng nhìn Sentinel-1 ở 22,3°N (Chương 12) / look azimuth at 22.3°N
    e = radar_effect(slope, aspect, 37, look)
    print(f'{name}: chồng lấn / layover {(e == 2).mean():.1%}, bóng / shadow {(e == 3).mean():.1%}, co ngắn / foreshortening {(e == 1).mean():.1%}')
plt.figure(figsize=(6, 6)); plt.imshow(radar_effect(slope, aspect, 37, 77.6), cmap='magma'); plt.title('ASC θ = 37°'); plt.axis('off'); plt.show()"""),
    (MD, """## Bài tập / Exercises

1. Đổi `X0, Y1` sang Phong Nha – Kẻ Bàng (UTM 48N khoảng E 627 000, N 1 935 000). / Move to Phong Nha – Ke Bang.
2. Dùng `ee.Terrain.slope` và so với hàm Horn ở trên. / Compare with `ee.Terrain.slope`.

*Copernicus DEM © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA; SRTM courtesy NASA/USGS.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch12_dem")
