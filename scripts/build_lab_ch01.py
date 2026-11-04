"""Generate labs/ch01_overview.ipynb (Colab).

    cd scripts && python build_lab_ch01.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 1 — Vệ tinh quan sát Trái Đất / Earth-observation satellites

**Sổ tay Viễn thám & GIS — Chương 1** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch01-overview/)

1. Đọc phần tử quỹ đạo từ CelesTrak, tính độ cao và chu kỳ / Read CelesTrak elements, compute altitude and period.
2. Đếm ảnh Sentinel-2, Landsat 9, Sentinel-1 chụp Hà Nội năm 2024 / Count 2024 images of Hanoi.
3. Diện tích khung một cảnh / Area of one scene."""),
    (PY, """import json, urllib.request
import numpy as np
import ee

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Phần tử quỹ đạo / Orbital elements (CelesTrak GP)"),
    (PY, """MU, RE = 398600.4418, 6378.137   # km^3/s^2, km
SATS = {'Sentinel-2A': 40697, 'Sentinel-1A': 39634, 'Landsat 9': 49260, 'VNREDSat-1': 39160}

def gp(norad):
    url = f'https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=json'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'rs-handbook-lab'}), timeout=60) as r:
        return json.load(r)[0]

for name, norad in SATS.items():
    d = gp(norad)
    T = 86400 / d['MEAN_MOTION']                    # s
    a = (MU * (T / (2 * np.pi)) ** 2) ** (1 / 3)      # Kepler III
    print(f"{name:12s} epoch {d['EPOCH'][:10]}  i = {d['INCLINATION']:.2f}°  T = {T/60:.2f} min  h = {a - RE:.1f} km  v = {np.sqrt(MU/a):.2f} km/s")"""),
    (MD, "## 2. Số ảnh chụp Hà Nội năm 2024 / Images of Hanoi in 2024"),
    (PY, """hanoi = ee.Geometry.Point([105.83, 21.05])
cols = {
    'Sentinel-2 L2A': ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED'),
    'Landsat 9 L2': ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'),
    'Sentinel-1 GRD': ee.ImageCollection('COPERNICUS/S1_GRD').filter(ee.Filter.eq('instrumentMode', 'IW')),
}
for name, col in cols.items():
    c = col.filterBounds(hanoi).filterDate('2024-01-01', '2025-01-01')
    dates = c.aggregate_array('system:time_start').map(lambda t: ee.Date(t).format('YYYY-MM-dd')).distinct().size()
    print(f'{name:15s} {c.size().getInfo():4d} ảnh/images, {dates.getInfo():4d} ngày/dates')"""),
    (MD, "## 3. Diện tích một cảnh / Area of one scene"),
    (PY, """scenes = {
    'Sentinel-2 tile T48QWJ': ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ'),
    'Landsat 9 127/045': ee.Image('LANDSAT/LC09/C02/T1_L2/LC09_127045_20231222'),
}
for name, img in scenes.items():
    g = ee.Geometry(img.get('system:footprint'))
    area = ee.Geometry.Polygon(g.coordinates()).area(1000).divide(1e6).getInfo()
    print(f'{name:22s} {area:9.0f} km²  = {area / 26.2144:6.0f} × khung Hồ Tây / West Lake frame')"""),
    (MD, """## Bài tập / Exercises

1. Thêm vệ tinh khác vào `SATS` (tra số NORAD trên CelesTrak). / Add another satellite.
2. Đổi `hanoi` sang tỉnh của bạn. / Move the point to your province.

*Contains modified Copernicus Sentinel data; Landsat courtesy of USGS; orbital elements from CelesTrak.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch01_overview")
