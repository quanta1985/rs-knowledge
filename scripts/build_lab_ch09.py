"""Generate labs/ch09_classification.ipynb (Colab).

    cd scripts && python build_lab_ch09.py           # write the notebook
    cd scripts && python build_lab_ch09.py --run     # also execute the code cells locally (needs EE auth)
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 9 — Phân loại & độ chính xác / Classification & accuracy

**Sổ tay Viễn thám & GIS — Chương 9** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/ch09-classification/)

1. Huấn luyện Random Forest trong Earth Engine / Train a Random Forest in Earth Engine.
2. Lấy mẫu kiểm định phân tầng theo bản đồ / Draw a stratified validation sample.
3. Ma trận nhầm lẫn, OA, UA, PA và diện tích có khoảng tin cậy (Olofsson et al. 2014) / Confusion matrix and adjusted areas.

Tham chiếu là ESA WorldCover 2021, **không phải sự thật mặt đất**. / The reference is ESA WorldCover 2021, **not ground truth**."""),
    (PY, """import ee
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

PROJECT = 'YOUR-CLOUD-PROJECT-ID'  # <-- sửa / edit
try:
    ee.Initialize(project=PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT)"""),
    (MD, "## 1. Ảnh và tham chiếu / Image and reference"),
    (PY, """X0, Y1, N, RES = 583980, 2331020, 512, 10   # khung Chương 6, 9 / Ch. 6 and 9 frame
FRAME = ee.Geometry.Rectangle([X0, Y1 - N * RES, X0 + N * RES, Y1], 'EPSG:32648', False)
BANDS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
NAMES = ['Nước/Water', 'Cây gỗ/Trees', 'Thực vật thấp/Low veg.', 'Đô thị/Built-up', 'Đất trống/Bare']
COLORS = ['#0072B2', '#009E73', '#F0E442', '#D55E00', '#CC79A7']

img = (ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ')
       .select(BANDS).divide(10000))
# WorldCover -> 5 lớp / 5 classes (255 = khác / other)
ref = (ee.ImageCollection('ESA/WorldCover/v200').first()
       .remap([80, 90, 10, 20, 30, 40, 50, 60], [0, 0, 1, 2, 2, 2, 3, 4], 255).rename('ref'))"""),
    (MD, """## 2. Random Forest

Lấy điểm huấn luyện phân tầng từ WorldCover (cách nhanh để thực hành; trong công việc thật nên giải đoán mẫu bằng mắt).
Training points are drawn from WorldCover for speed; in real work interpret them visually."""),
    (PY, """train = img.addBands(ref).stratifiedSample(numPoints=60, classBand='ref', region=FRAME, scale=10, seed=1,
                                          classValues=[255], classPoints=[0], geometries=True)
rf = ee.Classifier.smileRandomForest(100).train(train, 'ref', BANDS)
cls = img.classify(rf).rename('map')

def pixels(image):
    arr = ee.data.computePixels({'expression': image, 'fileFormat': 'NUMPY_NDARRAY',
        'grid': {'dimensions': {'width': N, 'height': N}, 'crsCode': 'EPSG:32648',
                 'affineTransform': {'scaleX': RES, 'shearX': 0, 'translateX': X0, 'shearY': 0, 'scaleY': -RES, 'translateY': Y1}}})
    return {b: np.asarray(arr[b]) for b in arr.dtype.names}

px = pixels(cls.addBands(ref).toInt16())
m, r = px['map'], px['ref']
cmap = ListedColormap(COLORS)
fig, ax = plt.subplots(1, 2, figsize=(12, 6), layout='constrained')
ax[0].imshow(m, cmap=cmap, vmin=0, vmax=4, interpolation='nearest'); ax[0].set_title('Random Forest')
ax[1].imshow(np.where(r < 5, r, np.nan), cmap=cmap, vmin=0, vmax=4, interpolation='nearest'); ax[1].set_title('ESA WorldCover 2021')
for a in ax: a.set_axis_off()
plt.show()
print('trùng WorldCover / agreement:', round(float((m[r < 5] == r[r < 5]).mean() * 100), 1), '%')"""),
    (MD, """## 3. Mẫu kiểm định phân tầng & diện tích / Stratified validation & areas

Olofsson et al. (2014): p̂ᵢⱼ = Wᵢ nᵢⱼ / nᵢ, Âⱼ = A Σᵢ p̂ᵢⱼ."""),
    (PY, """rng = np.random.default_rng(1)
valid = r < 5
mapped = m[valid]; truth = r[valid]
K, n_per = 5, 50
idx = np.concatenate([rng.choice(np.flatnonzero(mapped == k), n_per, replace=False) for k in range(K) if (mapped == k).sum() >= n_per])
C = np.zeros((K, K), int)
np.add.at(C, (mapped[idx], truth[idx]), 1)          # hàng = bản đồ, cột = tham chiếu / rows = map, cols = reference
W = np.bincount(mapped, minlength=K) / mapped.size
ni = C.sum(1, keepdims=True)
p = W[:, None] * C / np.maximum(ni, 1)
A = mapped.size * RES ** 2 / 1e6                    # km²
area = A * p.sum(0)
se = np.sqrt(((W[:, None] ** 2) * (C / np.maximum(ni, 1)) * (1 - C / np.maximum(ni, 1)) / np.maximum(ni - 1, 1)).sum(0))
print('ma trận nhầm lẫn / confusion matrix\\n', C)
print('OA (có trọng số / weighted) =', round(float(np.trace(p)), 3))
for k in range(K):
    print(f'{NAMES[k]:24s} đếm pixel/pixel count {W[k] * A:6.2f}  ước lượng/estimate {area[k]:6.2f} ± {1.96 * A * se[k]:.2f} km²'
          f'   WorldCover {(truth == k).sum() * RES ** 2 / 1e6:6.2f}')"""),
    (MD, """## Bài tập / Exercises

1. Đổi `n_per` thành 20 và 100. Khoảng tin cậy thay đổi thế nào? / Change `n_per` to 20 and 100.
2. Bỏ kênh B11, B12 khỏi `BANDS`. Lớp nào bị ảnh hưởng nhất? / Drop B11 and B12: which class suffers most?
3. Tự giải đoán 30 điểm trên Google Earth và so với WorldCover. / Interpret 30 points yourself and compare.

*Contains modified Copernicus Sentinel data 2024; © ESA WorldCover project 2021.*"""),
]

if __name__ == "__main__":
    main(CELLS, "ch09_classification")
