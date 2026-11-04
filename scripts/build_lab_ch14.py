"""Generate labs/ch14_gee.ipynb (Colab).

    cd scripts && python build_lab_ch14.py           # write the notebook
    cd scripts && python build_lab_ch14.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 14 — Google Earth Engine: lọc, map, reduce / filter, map, reduce

**Sổ tay Viễn thám & GIS — Chương 14** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch14-platforms/)

1. Lọc ImageCollection / Filter an ImageCollection.
2. So sánh lọc theo mây của tile và theo độ trong của khung / Tile cloud vs frame-clear filtering.
3. map() NDVI + che mây, rồi so sánh các reducer / map() NDVI + cloud mask, compare reducers.
4. Xuất ảnh trung vị / Export the median composite."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Lọc / Filter"),
    (PY, """X0, Y1, SIZE = 583980, 2331020, 5120   # khung Hồ Tây / West Lake frame (UTM 48N)
frame = ee.Geometry.Rectangle([X0, Y1 - SIZE, X0 + SIZE, Y1], 'EPSG:32648', False)
cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED')
col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(frame)
       .filterDate('2024-01-01', '2025-01-01').linkCollection(cs, ['cs_cdf']))
print('ảnh / images:', col.size().getInfo())
print('mây tile ≤ 20 % / tile cloud ≤ 20 %:', col.filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 20)).size().getInfo())"""),
    (MD, "## 2. Độ trong của chính khung / Clear share of the frame itself"),
    (PY, """def add_clear(img):
    clear = img.select('cs_cdf').gte(0.6).reduceRegion(ee.Reducer.mean(), frame, 20).get('cs_cdf')
    return img.set('clear', clear)

rows = col.map(add_clear).reduceColumns(ee.Reducer.toList(3), ['system:time_start', 'CLOUDY_PIXEL_PERCENTAGE', 'clear']).get('list').getInfo()
t = np.array([np.datetime64(int(r[0]), 'ms') for r in rows]); cloud = np.array([r[1] for r in rows]); clear = np.array([r[2] or 0 for r in rows])
print('khung trong ≥ 90 % / frame clear ≥ 90 %:', int((clear >= 0.9).sum()), 'ảnh / images')
plt.figure(figsize=(10, 3.5))
plt.scatter(t, cloud, c=np.where(clear >= 0.9, '#0072B2', '#cccccc'), edgecolors='k', linewidths=0.4)
plt.axhline(20, ls='--', c='0.4'); plt.ylabel('CLOUDY_PIXEL_PERCENTAGE (tile)')
plt.title('Xanh = khung trong ≥ 90 % / blue = frame ≥ 90 % clear'); plt.show()"""),
    (MD, "## 3. map() + reduce"),
    (PY, """def ndvi(img):
    return img.normalizedDifference(['B8', 'B4']).rename('ndvi').updateMask(img.select('cs_cdf').gte(0.6))

stack = col.map(ndvi)
reducers = {'median': stack.median(), 'max': stack.max(), 'count': stack.count()}
N = 128   # 40 m
grid = {'dimensions': {'width': N, 'height': N}, 'crsCode': 'EPSG:32648',
        'affineTransform': {'scaleX': 40, 'shearX': 0, 'translateX': X0, 'shearY': 0, 'scaleY': -40, 'translateY': Y1}}
fig, ax = plt.subplots(1, 3, figsize=(15, 5), layout='constrained')
for a, (name, img) in zip(ax, reducers.items()):
    arr = ee.data.computePixels({'expression': img.rename('v'), 'fileFormat': 'NUMPY_NDARRAY', 'grid': grid})['v'].astype(float)
    im = a.imshow(arr, cmap='viridis' if name == 'count' else 'BrBG', **({} if name == 'count' else {'vmin': -1, 'vmax': 1}))
    a.set_title(f'{name}  (trung vị khung / frame median {np.nanmedian(arr):.3f})'); a.set_axis_off(); fig.colorbar(im, ax=a, shrink=0.7)
plt.show()"""),
    (MD, """## 4. Xuất / Export

Bỏ dấu `#` ở dòng `task.start()` để thật sự xuất ra Google Drive. / Uncomment `task.start()` to really export to Google Drive."""),
    (PY, """task = ee.batch.Export.image.toDrive(image=reducers['median'], description='ndvi_median_2024_westlake',
                                     region=frame, scale=10, crs='EPSG:32648', maxPixels=1e9)
# task.start()
print(task.config['description'] if hasattr(task, 'config') else 'task ready')"""),
    (MD, """## Bài tập / Exercises

1. Đổi khung sang quê bạn. / Move the frame to your home town.
2. Ảnh NDVI max theo quý. / Quarterly max-NDVI composites.
3. Dùng `qualityMosaic('ndvi')` thay `max()`. / Use `qualityMosaic('ndvi')` instead of `max()`.

*Contains modified Copernicus Sentinel data 2024.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch14_gee")
