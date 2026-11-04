"""Generate labs/ch05_gis.ipynb (Colab).

    cd scripts && python build_lab_ch05.py           # write the notebook
    cd scripts && python build_lab_ch05.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 5 — Hệ tọa độ, VN-2000, raster và vector / CRS, VN-2000, raster and vector

**Sổ tay Viễn thám & GIS — Chương 5** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch05-gis/)

1. Một điểm qua WGS84, UTM, VN-2000 bằng `pyproj` / One point through WGS84, UTM and VN-2000 with `pyproj`.
2. Tự viết phép Helmert 7 tham số và so với PROJ / Write the 7-parameter Helmert yourself and compare with PROJ.
3. Diện tích Hồ Tây: đếm pixel và vector hóa bằng Earth Engine / West Lake area: pixel count vs Earth Engine vectorisation."""),
    (PY, """import ee
import numpy as np
from pyproj import Transformer

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, """## 1. Một điểm, bốn hệ / One point, four systems

EPSG:32648 = WGS84/UTM 48N · 4756 = VN-2000 · 3405 = VN-2000/UTM 48N · 5897 = VN-2000/TM-3 105°."""),
    (PY, """LON, LAT = 105.8342, 21.0278   # Hồ Hoàn Kiếm; thử điểm của bạn / try your own point
for code in [32648, 4756, 3405, 5897]:
    x, y = Transformer.from_crs(4326, code, always_xy=True).transform(LON, LAT)
    print(f'EPSG:{code}: {x:,.7f}  {y:,.7f}' if code == 4756 else f'EPSG:{code}: E {x:,.2f}  N {y:,.2f}')
e1, n1 = Transformer.from_crs(4326, 32648, always_xy=True).transform(LON, LAT)
e2, n2 = Transformer.from_crs(4326, 3405, always_xy=True).transform(LON, LAT)
print(f'VN-2000 UTM - WGS84 UTM: dE = {e2 - e1:.1f} m, dN = {n2 - n1:.1f} m, {np.hypot(e2 - e1, n2 - n1):.1f} m')"""),
    (MD, """## 2. Helmert 7 tham số / 7-parameter Helmert

Tham số Thông tư 973/2001/TT-TCĐC = EPSG:6960, chiều VN-2000 → WGS84, quy ước *coordinate frame*.
Parameters of Circular 973/2001 = EPSG:6960, VN-2000 → WGS84, coordinate-frame convention."""),
    (PY, """A, F = 6378137.0, 1 / 298.257223563
E2 = F * (2 - F)
T = np.array([-191.90441429, -39.30318279, -111.45032835])
RX, RY, RZ = np.radians(np.array([-0.00928836, 0.01975479, -0.00427372]) / 3600)
S = 0.252906278e-6
R = np.array([[1, RZ, -RY], [-RZ, 1, RX], [RY, -RX, 1]])   # coordinate frame

def to_ecef(lon, lat):
    p, l = np.radians(lat), np.radians(lon); n = A / np.sqrt(1 - E2 * np.sin(p) ** 2)
    return np.array([n * np.cos(p) * np.cos(l), n * np.cos(p) * np.sin(l), n * (1 - E2) * np.sin(p)])

def from_ecef(v):
    x, y, z = v; r = np.hypot(x, y); p = np.arctan2(z, r * (1 - E2))
    for _ in range(6):
        n = A / np.sqrt(1 - E2 * np.sin(p) ** 2); p = np.arctan2(z + E2 * n * np.sin(p), r)
    return np.degrees(np.arctan2(y, x)), np.degrees(p)

# WGS84 -> VN-2000 = nghịch đảo / inverse
mine = from_ecef(R.T @ ((to_ecef(LON, LAT) - T) / (1 + S)))
proj = Transformer.from_crs(4326, 4756, always_xy=True).transform(LON, LAT)
print('tự viết / mine :', mine)
print('PROJ           :', proj)
print('sai khác / diff (m): %.4f' % (np.hypot(mine[0] - proj[0], mine[1] - proj[1]) * 111_000))"""),
    (MD, """## 3. Hồ Tây: raster và vector / West Lake: raster and vector

MNDWI ≥ 0 trên ảnh Sentinel-2 12/02/2024; giữ vùng chứa Hồ Tây. / MNDWI ≥ 0 on the 12 Feb 2024 scene; keep the region containing West Lake."""),
    (PY, """X0, Y1, N, RES = 583980, 2331020, 512, 10
frame = ee.Geometry.Rectangle([X0, Y1 - N * RES, X0 + N * RES, Y1], 'EPSG:32648', False)
img = ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ')
water = img.normalizedDifference(['B3', 'B11']).gte(0).selfMask().clip(frame)
lake_pt = ee.Geometry.Point([105.8205, 21.0525])   # giữa Hồ Tây / middle of West Lake
vec = water.reduceToVectors(geometry=frame, crs='EPSG:32648', scale=RES, geometryType='polygon', eightConnected=True, maxPixels=1e9)
lake = vec.filterBounds(lake_pt).first().geometry()
pix = water.clip(lake).multiply(ee.Image.pixelArea()).reduceRegion(ee.Reducer.sum(), lake, RES, crs='EPSG:32648').getInfo()
area_vec = lake.area(maxError=1, proj='EPSG:32648').getInfo()
nv = lambda g: ee.List(g.coordinates()).flatten().length().divide(2).getInfo()   # số đỉnh / vertex count
n_vert = nv(lake)
print(f'pixel: {list(pix.values())[0] / 1e6:.3f} km²   vector: {area_vec / 1e6:.3f} km²   đỉnh / vertices: {n_vert}')
for tol in [10, 50, 100]:
    s = lake.simplify(maxError=tol, proj='EPSG:32648')
    print(f'  simplify {tol:3d} m: {nv(s):5.0f} đỉnh, {s.area(maxError=1, proj="EPSG:32648").getInfo() / 1e6:.3f} km²')"""),
    (MD, """Earth Engine vector hóa theo **cạnh pixel** (bậc thang), nên diện tích vector gần bằng diện tích pixel. Sổ tay vẽ đường đồng mức qua tâm pixel nên nhỏ hơn một chút (5,100 so với 5,128 km²). Số liệu ở đây hơi khác sổ tay vì Earth Engine tự nội suy kênh B11 (20 m) về 10 m.
Earth Engine vectorises along **pixel edges** (stair steps), so its polygon area is close to the pixel area; the handbook traces a contour through pixel centres, which is slightly smaller (5.100 vs 5.128 km²). Numbers differ a little from the handbook because Earth Engine resamples B11 (20 m) to 10 m on the fly.

## Bài tập / Exercises

1. Đổi `LON, LAT` sang nhà bạn và tính tọa độ TM-3 theo kinh tuyến trục tỉnh bạn. / Use your own point and your province's central meridian.
2. Tìm một hồ khác và so sánh diện tích pixel với vector. / Repeat for another lake.

*Contains modified Copernicus Sentinel data 2024.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch05_gis")
