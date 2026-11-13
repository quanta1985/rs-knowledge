/**
 * Lab 14 — Phân loại Random Forest & đánh giá độ chính xác / Random Forest classification & accuracy
 * Sổ tay Viễn thám & GIS. Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Tham chiếu: ESA WorldCover 2021 (không phải sự thật mặt đất). Reference: ESA WorldCover 2021 (not ground truth).
 * Contains modified Copernicus Sentinel data; © ESA WorldCover project 2021.
 */

// ---- Thông số / parameters ----
var aoi = ee.Geometry.Rectangle([105.80, 21.03, 105.86, 21.08]);  // Hồ Tây; đổi tùy ý / change freely
var START = '2024-01-01', END = '2024-04-01';
var BANDS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
var NAMES = ['Nước', 'Cây gỗ', 'Thực vật thấp', 'Đô thị', 'Đất trống'];
var PALETTE = ['0072B2', '009E73', 'F0E442', 'D55E00', 'CC79A7'];
var N_TRAIN = 60, N_VALID = 50;   // điểm mỗi lớp / points per class

Map.centerObject(aoi, 13);

// Ảnh trung vị không mây (Cloud Score+) / cloud-free median
var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var img = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(aoi).filterDate(START, END)
  .linkCollection(cs, ['cs_cdf'])
  .map(function (i) { return i.updateMask(i.select('cs_cdf').gte(0.6)); })
  .median().select(BANDS).divide(10000).clip(aoi);
Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.2}, 'Sentinel-2');

var ref = ee.ImageCollection('ESA/WorldCover/v200').first()
  .remap([80, 90, 10, 20, 30, 40, 50, 60], [0, 0, 1, 2, 2, 2, 3, 4], 255).rename('ref').clip(aoi);
Map.addLayer(ref.updateMask(ref.lt(5)), {min: 0, max: 4, palette: PALETTE}, 'WorldCover (5 lớp)', false);

// ---- Random Forest ----
var train = img.addBands(ref).stratifiedSample({numPoints: N_TRAIN, classBand: 'ref', region: aoi, scale: 10, seed: 1,
  classValues: [255], classPoints: [0], geometries: true});
var rf = ee.Classifier.smileRandomForest(100).train(train, 'ref', BANDS);
var map = img.classify(rf).rename('map');
Map.addLayer(map, {min: 0, max: 4, palette: PALETTE}, 'Random Forest');

// ---- Mẫu kiểm định phân tầng theo bản đồ / stratified validation sample by map class ----
var valid = map.addBands(ref).updateMask(ref.lt(5)).stratifiedSample({numPoints: N_VALID, classBand: 'map',
  region: aoi, scale: 10, seed: 2, geometries: true});
var cm = valid.errorMatrix('ref', 'map');   // GEE: hàng = tham chiếu, cột = bản đồ / rows = reference, cols = map
print('Ma trận nhầm lẫn (hàng = tham chiếu, cột = bản đồ)', cm);

// ---- Diện tích hiệu chỉnh (Olofsson et al. 2014) / adjusted areas ----
var pixArea = ee.Image.pixelArea().divide(1e6);
var mapArea = pixArea.addBands(map).updateMask(ref.lt(5)).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'cls'}), geometry: aoi, scale: 10, maxPixels: 1e9}).get('groups');
mapArea = ee.List(mapArea).map(function (g) { return ee.Number(ee.Dictionary(g).get('sum')); });
var A = ee.Number(mapArea.reduce(ee.Reducer.sum()));
var M = ee.Array(cm.array()).transpose();          // hàng = bản đồ / rows = map
var ni = M.reduce(ee.Reducer.sum(), [1]);          // K x 1
var W = ee.Array(mapArea).divide(A).reshape([-1, 1]);
var P = M.divide(ni.repeat(1, 5)).multiply(W.repeat(1, 5));
var est = P.reduce(ee.Reducer.sum(), [0]).multiply(A);
print('Diện tích bản đồ (km², đếm pixel)', mapArea);
print('Diện tích ước lượng (km², Olofsson)', est);
print('OA có trọng số / weighted OA', P.matrixDiagonal().reduce(ee.Reducer.sum(), [0]));
Map.addLayer(valid, {color: 'white'}, 'Điểm kiểm định / validation points', false);
