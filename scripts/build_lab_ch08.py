"""Generate labs/ch08_interpretation.ipynb (Colab).

    cd scripts && python build_lab_ch08.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 8 — Tổ hợp màu & giải đoán / Composites & interpretation

**Sổ tay Viễn thám & GIS — Chương 8** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch08-interpretation/)

1. Tải bốn cảnh Việt Nam / Load four Vietnamese scenes.
2. Bốn tổ hợp màu, hai kiểu kéo giãn / Four composites, two stretches.
3. Kiểm tra diễn giải bằng MNDWI / Check an interpretation with MNDWI."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)

N, RES = 512, 10
SCENES = {  # tâm, ngày (chọn bằng Cloud Score+) / centre, date (chosen with Cloud Score+)
    'Ca Mau': ((104.97, 8.68), '2024-01-30'), 'An Giang': ((105.005, 10.49), '2024-01-15'),
    'Da Lat': ((108.44, 11.94), '2023-02-11'), 'Da Nang': ((108.215, 16.055), '2023-03-23'),
}
BANDS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']

def load(lonlat, day):
    zone = int((lonlat[0] + 180) // 6) + 1; crs = f'EPSG:326{zone:02d}'
    x, y = ee.Geometry.Point(lonlat).transform(crs, 1).coordinates().getInfo()
    x0, y1 = round((x - N * RES / 2) / 20) * 20, round((y + N * RES / 2) / 20) * 20
    region = ee.Geometry.Rectangle([x0, y1 - N * RES, x0 + N * RES, y1], ee.Projection(crs), False)
    d = ee.Date(day)
    img = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(region).filterDate(d, d.advance(1, 'day')).mosaic()
    arr = ee.data.computePixels({'expression': img.select(BANDS), 'fileFormat': 'NUMPY_NDARRAY',
        'grid': {'dimensions': {'width': N, 'height': N}, 'crsCode': crs,
                 'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': x0, 'shearY': 0, 'scaleY': -RES, 'translateY': y1}}})
    return {b: arr[b].astype('float32') / 1e4 for b in BANDS}

data = {k: load(*v) for k, v in SCENES.items()}"""),
    (MD, "## Tổ hợp màu / Composites (kéo giãn 2–98 % / 2–98 % stretch)"),
    (PY, """PRESETS = {'4-3-2': ('B4', 'B3', 'B2'), '8-4-3': ('B8', 'B4', 'B3'), '11-8-2': ('B11', 'B8', 'B2'), '12-11-4': ('B12', 'B11', 'B4')}
def stretch(v, fixed=None):
    lo, hi = fixed or np.percentile(v, [2, 98])
    return np.clip((v - lo) / (hi - lo), 0, 1)

fig, ax = plt.subplots(len(data), len(PRESETS), figsize=(16, 16), layout='constrained')
for i, (name, d) in enumerate(data.items()):
    for j, (p, rgb) in enumerate(PRESETS.items()):
        ax[i, j].imshow(np.dstack([stretch(d[b]) for b in rgb])); ax[i, j].set_title(f'{name} · {p}', fontsize=9); ax[i, j].set_axis_off()
plt.show()"""),
    (MD, "## Kéo giãn cố định / Fixed stretch 0–0.3"),
    (PY, """fig, ax = plt.subplots(1, len(data), figsize=(16, 4.5), layout='constrained')
for a, (name, d) in zip(ax, data.items()):
    a.imshow(np.dstack([stretch(d[b], (0, 0.3)) for b in ('B4', 'B3', 'B2')])); a.set_title(name); a.set_axis_off()
plt.show()"""),
    (MD, """## Trông như nước nhưng không phải nước / Looks like water but is not

Khối xanh tím ở An Giang: đo MNDWI. / The blue-purple block in An Giang: measure MNDWI."""),
    (PY, """mndwi = lambda d: (d['B3'] - d['B11']) / (d['B3'] + d['B11'])
ndvi = lambda d: (d['B8'] - d['B4']) / (d['B8'] + d['B4'])
yy, xx = np.mgrid[:N, :N]
block = (yy - 430) ** 2 + (xx - 330) ** 2 <= 30 ** 2          # khối xanh tím / blue-purple block
river = (yy - 100) ** 2 + (xx - 385) ** 2 <= 20 ** 2          # sông Hàn / Han River
ag, dn = data['An Giang'], data['Da Nang']
print(f'An Giang block: MNDWI = {mndwi(ag)[block].mean():+.2f}, NDVI = {ndvi(ag)[block].mean():.2f}')
print(f'Han River:      MNDWI = {mndwi(dn)[river].mean():+.2f}')
cm = data['Ca Mau']
print(f'Ca Mau: MNDWI > 0 {100 * (mndwi(cm) > 0).mean():.1f} %, NDVI > 0.6 {100 * (ndvi(cm) > 0.6).mean():.1f} %')"""),
    (MD, """## Bài tập / Exercises

1. Thêm một cảnh ở quê bạn vào `SCENES`. / Add a scene near you.
2. Tìm một đối tượng mỗi yếu tố giải đoán. / Find an example for each interpretation key.

*Contains modified Copernicus Sentinel data 2023–2024.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch08_interpretation")
