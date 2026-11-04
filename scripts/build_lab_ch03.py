"""Generate labs/ch03_physics.ipynb (Colab).

    cd scripts && python build_lab_ch03.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 3 — Bức xạ điện từ & khí quyển / EM radiation & the atmosphere

**Sổ tay Viễn thám & GIS — Chương 3** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch03-physics/)

1. Đường cong Planck, Wien, Stefan–Boltzmann / Planck curves.
2. Phổ Mặt Trời ASTM G173 và truyền qua tại các kênh Sentinel-2 / ASTM G173 and band transmittance.
3. Nhiệt độ bề mặt Hà Nội từ Landsat 9 / Hanoi surface temperature from Landsat 9."""),
    (PY, """import io, urllib.request
import numpy as np
import matplotlib.pyplot as plt
import ee

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Planck"),
    (PY, """H, C, K, SIGMA = 6.62607015e-34, 299792458, 1.380649e-23, 5.670374419e-8

def planck(um, T):   # W m-2 um-1
    l = um * 1e-6
    return 2 * np.pi * H * C**2 / l**5 / np.expm1(H * C / (l * K * T)) * 1e-6

um = np.logspace(-1, 2, 400)
plt.figure(figsize=(8, 4))
for T, lab in [(5772, 'Mặt Trời / Sun'), (1000, 'Cháy / fire'), (300, 'Trái Đất / Earth')]:
    plt.loglog(um, planck(um, T), label=f'{lab} {T} K, λmax = {2897.77/T:.2f} µm')
plt.ylim(1e-3, 1e9); plt.xlabel('µm'); plt.ylabel('W·m⁻²·µm⁻¹'); plt.legend(); plt.grid(alpha=.3); plt.show()

def share(a, b, T):
    x = np.logspace(np.log10(a), np.log10(b), 2000)
    return np.trapezoid(planck(x, T), x) / (SIGMA * T**4)
print('Sun 0.4–0.7 µm:', round(share(0.4, 0.7, 5772), 3), '| Earth 300 K, 8–14 µm:', round(share(8, 14, 300), 3))"""),
    (MD, "## 2. ASTM G173"),
    (PY, """URL = 'https://raw.githubusercontent.com/pvlib/pvlib-python/main/pvlib/data/ASTMG173.csv'
with urllib.request.urlopen(URL, timeout=60) as r:
    g = np.genfromtxt(io.StringIO(r.read().decode()), delimiter=',', skip_header=2)
nm, etr, glob, direct = g.T
plt.figure(figsize=(9, 3.8))
plt.plot(nm, etr, label='Ngoài khí quyển / extraterrestrial'); plt.plot(nm, glob, label='Mặt đất AM1.5 / ground')
plt.xlim(280, 2500); plt.xlabel('nm'); plt.ylabel('W·m⁻²·nm⁻¹'); plt.legend(); plt.show()

# dải kênh / band ranges (nm): S2B centre ± width/2; B9, B10 from S2A
S2 = {'B2': (459.1, 525.1), 'B4': (649.4, 680.4), 'B8': (779.9, 885.9), 'B9': (935.1, 955.1),
      'B10': (1358, 1389), 'B11': (1563.4, 1657.4), 'B12': (2093.2, 2278.2)}
for b, (lo, hi) in S2.items():
    m = (nm >= lo) & (nm <= hi)   # trung bình theo độ rộng kênh / band-averaged
    t = np.trapezoid(direct[m], nm[m]) / np.trapezoid(etr[m], nm[m])
    print(f'{b:4s} {lo:.0f}–{hi:.0f} nm  truyền qua / transmittance = {100 * t:6.2f} %')"""),
    (MD, "## 3. Landsat 9 ST_B10 — Hà Nội 22/12/2023"),
    (PY, """X0, Y1, RES, N = 583980, 2331020, 30, 171   # cùng góc khung Chương 6 / same corner as Ch. 6 frame
img = ee.Image('LANDSAT/LC09/C02/T1_L2/LC09_127045_20231222').select('ST_B10')
arr = ee.data.computePixels({'expression': img, 'fileFormat': 'NUMPY_NDARRAY',
    'grid': {'dimensions': {'width': N, 'height': N}, 'crsCode': 'EPSG:32648',
             'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': X0, 'shearY': 0, 'scaleY': -RES, 'translateY': Y1}}})
lst = arr['ST_B10'].astype('float32') * 0.00341802 + 149.0 - 273.15
print('P2, median, P98 =', np.percentile(lst, [2, 50, 98]).round(1), '°C')
print('Hồ Tây / West Lake:', round(float(lst[99:102, 52:55].mean()), 1), '°C')
plt.figure(figsize=(6, 5.5)); plt.imshow(lst, cmap='viridis', vmin=14, vmax=24)
plt.colorbar(label='°C'); plt.title('Landsat 9 LST, 22/12/2023 10:23'); plt.axis('off'); plt.show()"""),
    (MD, """## Bài tập / Exercises

1. Đổi cảnh Landsat sang một ngày mùa hè. Hồ Tây còn lạnh hơn phố xung quanh không? / Try a summer scene.
2. Tính λmax của mái tôn 60 °C. / Wien peak of a 60 °C metal roof.

*Landsat courtesy of USGS. ASTM G173-03 via NREL / pvlib.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch03_physics")
