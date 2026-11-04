"""Generate labs/ch02_orbits.ipynb (Colab).

    cd scripts && python build_lab_ch02.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 2 — Quỹ đạo & độ phủ / Orbits & coverage

**Sổ tay Viễn thám & GIS — Chương 2** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch02-orbits/)

1. Chu kỳ, vận tốc, độ nghiêng đồng bộ Mặt Trời theo độ cao / Period, velocity, SSO inclination vs altitude.
2. Vết bay Sentinel-2 qua Việt Nam trong 10 ngày / Sentinel-2 ground tracks over Viet Nam for 10 days.
3. So với số ảnh Sentinel-2 thật / Compare with real Sentinel-2 acquisitions."""),
    (PY, """import numpy as np
import matplotlib.pyplot as plt
import ee

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)

MU, RE, J2 = 398600.4418, 6378.137, 1.08263e-3
SUN = 360 / 365.2422   # độ/ngày / deg per day"""),
    (MD, "## 1. Kepler III và J2 / Kepler III and J2"),
    (PY, """def period_min(h): return 2 * np.pi * np.sqrt((RE + h) ** 3 / MU) / 60
def raan_rate(h, i_deg):   # độ/ngày / deg per day
    a = RE + h; n = np.sqrt(MU / a ** 3)
    return np.degrees(-1.5 * n * J2 * (RE / a) ** 2 * np.cos(np.radians(i_deg)) * 86400)
def sso_inc(h):
    a = RE + h; n = np.sqrt(MU / a ** 3)
    c = -np.radians(SUN) / 86400 / (1.5 * n * J2 * (RE / a) ** 2)
    return np.degrees(np.arccos(c)) if abs(c) <= 1 else np.nan

for h in [420, 705, 786, 20200, 35786]:
    print(f'h = {h:6d} km  T = {period_min(h):8.2f} min  v = {np.sqrt(MU/(RE+h)):.2f} km/s  SSO i = {sso_inc(h):.2f}°')
print('ISS (420 km, 51.6°) RAAN drift:', round(raan_rate(420, 51.6), 2), '°/day')

h = np.linspace(300, 1500, 100)
plt.figure(figsize=(7, 3.5)); plt.plot(h, [sso_inc(x) for x in h])
plt.xlabel('Độ cao / altitude (km)'); plt.ylabel('Độ nghiêng SSO / SSO inclination (°)'); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 2. Vết bay Sentinel-2 / Sentinel-2 ground tracks

14 3/10 vòng/ngày, 98,62°, nút xuống 10:30. Trong khung Mặt Trời, mặt phẳng quỹ đạo đứng yên và Trái Đất quay 15°/giờ bên dưới.
14 3/10 rev/day, 98.62°, descending node 10:30. In a Sun-fixed frame the plane is fixed and the Earth turns 15°/h below it."""),
    (PY, """REV, INC, LTDN = 14.3, np.radians(98.62), 10.5

def track(t_h):
    t0 = LTDN - 105 / 15
    u = np.radians(180 + 360 * REV * (t_h - t0) / 24)
    lat = np.degrees(np.arcsin(np.sin(INC) * np.sin(u)))
    dl = np.degrees(np.arctan2(np.cos(INC) * np.sin(u), np.cos(u)))
    lon = (105 - 180 - 15 * (t_h - t0) + dl + 180) % 360 - 180
    return lat, lon, np.cos(u) < 0

t = np.arange(0, 240, 10 / 3600)          # 10 ngày, bước 10 s / 10 days, 10 s steps
lat, lon, desc = track(t)
m = desc & (lat > 6) & (lat < 25) & (lon > 99) & (lon < 113)
plt.figure(figsize=(5, 7))
plt.scatter(lon[m], lat[m], c=(t[m] // 24), s=2, cmap='viridis')
plt.colorbar(label='Ngày / day'); plt.xlim(100, 112); plt.ylim(7, 24)
plt.title('Sentinel-2: nhánh đi xuống / descending passes'); plt.gca().set_aspect(1); plt.show()"""),
    (MD, "## 3. Số ảnh Sentinel-2 thật / Real Sentinel-2 acquisitions"),
    (PY, """pt = ee.Geometry.Point([105.83, 21.05])   # Hà Nội
col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(pt).filterDate('2024-01-01', '2024-02-01')
dates = sorted(set(col.aggregate_array('system:time_start').map(lambda x: ee.Date(x).format('YYYY-MM-dd')).getInfo()))
print(len(dates), 'ngày có ảnh / dates in Jan 2024:', dates)"""),
    (MD, """## Bài tập / Exercises

1. Đổi `REV = 14 + 9/16` gần với Landsat; quan sát vết bay. / Try a Landsat-like orbit.
2. Thêm vệ tinh thứ hai lệch pha 180° (cộng 180° vào `u`). / Add a second satellite 180° apart.

*Contains modified Copernicus Sentinel data.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch02_orbits")
