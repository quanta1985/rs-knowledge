"""Generate labs/ch13_vietnam.ipynb (Colab).

    cd scripts && python build_lab_ch13.py           # write the notebook
    cd scripts && python build_lab_ch13.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 13 — Case study Việt Nam / Viet Nam case studies

**Sổ tay Viễn thám & GIS — Chương 13** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch13-vietnam/)

1. Mất tán cây theo tỉnh (Hansen GFC) với ngưỡng tán tùy chọn / Tree-cover loss by province with any canopy threshold.
2. Nhiệt độ bề mặt theo lớp phủ cho một thành phố / Land surface temperature by land cover for a city.
3. Chuỗi NO₂ Sentinel-5P cho một điểm / Sentinel-5P NO₂ series for a point."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Mất tán cây Tây Nguyên / Central Highlands tree-cover loss"),
    (PY, """CANOPY = 30   # thử 10, 50 / try 10, 50
gfc = ee.Image('UMD/hansen/global_forest_change_2025_v1_13')
prov = (ee.FeatureCollection('FAO/GAUL/2015/level1').filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam'))
        .filter(ee.Filter.inList('ADM1_NAME', ['Kon Tum', 'Gia Lai', 'Dak Lak', 'Dak Nong', 'Lam Dong'])))  # ranh giới trước 2025
forest = gfc.select('treecover2000').gte(CANOPY)
lost = forest.And(gfc.select('loss'))
ha = ee.Image.pixelArea().divide(1e4)
stats = ha.updateMask(forest).rename('f2000').addBands(ha.updateMask(lost).rename('lost')) \\
    .reduceRegions(collection=prov, reducer=ee.Reducer.sum(), scale=30, tileScale=8).getInfo()
for f in stats['features']:
    p = f['properties']
    print(f"{p['ADM1_NAME']:9s} rừng 2000 / forest 2000 {p['f2000']:>10,.0f} ha · mất / lost {p['lost']:>9,.0f} ha · {100 * p['lost'] / p['f2000']:.1f} %")"""),
    (PY, """# diện tích mất theo năm cho cả vùng / annual loss for the whole region
by_year = ha.updateMask(lost).addBands(gfc.select('lossyear')).reduceRegion(
    reducer=ee.Reducer.sum().group(groupField=1, groupName='year'), geometry=prov.geometry(), scale=30, maxPixels=1e10, tileScale=8).getInfo()
years = [2000 + g['year'] for g in by_year['groups']]
plt.figure(figsize=(10, 3.5))
plt.bar(years, [g['sum'] / 1000 for g in by_year['groups']], color='#21918c')
plt.ylabel('nghìn ha / thousand ha'); plt.title(f'Mất tán cây Tây Nguyên (tán ≥ {CANOPY} %) / tree-cover loss'); plt.show()"""),
    (MD, "## 2. Nhiệt độ bề mặt theo lớp phủ / LST by land cover"),
    (PY, """CITY = ee.Geometry.Point([106.70, 10.78]).buffer(20000).bounds()   # TP.HCM; thử / try Hà Nội [105.85, 21.03]

def lst(img):
    clear = img.select('QA_PIXEL').bitwiseAnd(0b11110).eq(0)   # mây, bóng mây / clouds, shadows
    return img.select('ST_B10').multiply(0.00341802).add(149.0 - 273.15).rename('lst').updateMask(clear)

col = (ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
       .filterBounds(CITY).filterDate('2024-01-01', '2024-05-01').filter(ee.Filter.lt('CLOUD_COVER', 30)))
print('cảnh / scenes:', col.size().getInfo())
med = col.map(lst).median()
wc = ee.ImageCollection('ESA/WorldCover/v200').first()
names = {10: 'cây gỗ / trees', 30: 'cỏ / grass', 40: 'trồng trọt / crops', 50: 'xây dựng / built-up', 80: 'nước / water'}
for code, name in names.items():
    v = med.updateMask(wc.eq(code)).reduceRegion(ee.Reducer.mean(), CITY, 100, maxPixels=1e9).get('lst').getInfo()
    print(f'{name:22s} {v:.1f} °C' if v is not None else f'{name:22s} —')"""),
    (MD, "## 3. NO₂ Sentinel-5P"),
    (PY, """POINT = ee.Geometry.Point([105.85, 21.03]).buffer(10000)   # Hà Nội; đổi tùy ý / change freely
no2 = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2').select('tropospheric_NO2_column_number_density')

def month(i):
    d = ee.Date('2024-01-01').advance(i, 'month')
    v = no2.filterDate(d, d.advance(1, 'month')).mean().multiply(1e6).reduceRegion(ee.Reducer.mean(), POINT, 1113)
    return ee.Feature(None, {'m': d.format('YYYY-MM'), 'v': v.values().get(0)})

rows = ee.FeatureCollection(ee.List.sequence(0, 11).map(month)).getInfo()['features']
plt.figure(figsize=(9, 3.2))
plt.plot([r['properties']['m'] for r in rows], [r['properties']['v'] for r in rows], 'o-', color='#D55E00')
plt.ylabel('µmol/m²'); plt.xticks(rotation=45); plt.title('NO₂ tầng đối lưu 2024 / tropospheric NO₂'); plt.tight_layout(); plt.show()"""),
    (MD, """## Bài tập / Exercises

1. Đổi `CANOPY` sang 10 và 50. Tỷ lệ mất thay đổi thế nào? / How does the loss share change?
2. Đổi `CITY` sang Hà Nội hoặc Đà Nẵng. / Try Hanoi or Da Nang.
3. Đặt `POINT` ở một nhà máy nhiệt điện. / Put `POINT` on a coal power plant.

*Hansen/UMD/Google/USGS/NASA; Landsat courtesy of USGS; contains modified Copernicus Sentinel data; ESA WorldCover.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch13_vietnam")
