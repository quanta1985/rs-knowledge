/**
 * Lab 13 — Case study Việt Nam / Viet Nam case studies · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Hansen/UMD/Google/USGS/NASA; Landsat courtesy of USGS; contains modified Copernicus Sentinel data; ESA WorldCover.
 */

// ---- 1. Mất tán cây Tây Nguyên / Central Highlands tree-cover loss ----
var CANOPY = 30;  // thử / try 10, 50
var gfc = ee.Image('UMD/hansen/global_forest_change_2025_v1_13');
var prov = ee.FeatureCollection('FAO/GAUL/2015/level1')  // ranh giới trước 2025 / pre-2025 boundaries
  .filter(ee.Filter.eq('ADM0_NAME', 'Viet Nam'))
  .filter(ee.Filter.inList('ADM1_NAME', ['Kon Tum', 'Gia Lai', 'Dak Lak', 'Dak Nong', 'Lam Dong']));
var forest = gfc.select('treecover2000').gte(CANOPY);
var lost = forest.and(gfc.select('loss'));
Map.centerObject(prov, 7);
Map.setOptions('SATELLITE');
Map.addLayer(forest.selfMask(), {palette: '009E73'}, 'Rừng 2000 / forest 2000', false);
Map.addLayer(gfc.select('lossyear').updateMask(lost), {min: 1, max: 25, palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']}, 'Năm mất / loss year');
Map.addLayer(ee.Image().paint(prov, 0, 2), {palette: 'ffffff'}, 'Tỉnh / provinces');

var ha = ee.Image.pixelArea().divide(1e4);
var stats = ha.updateMask(forest).rename('f2000').addBands(ha.updateMask(lost).rename('lost'))
  .reduceRegions({collection: prov, reducer: ee.Reducer.sum(), scale: 30, tileScale: 8});
print('Mất tán cây theo tỉnh (ha) / loss by province (ha)', stats.select(['ADM1_NAME', 'f2000', 'lost']));

// ---- 2. Nhiệt độ bề mặt TP.HCM / HCMC land surface temperature ----
var city = ee.Geometry.Point([106.70, 10.78]).buffer(20000).bounds();
function lst(img) {
  var clear = img.select('QA_PIXEL').bitwiseAnd(30).eq(0);  // bit 1-4: mây, bóng / clouds, shadows
  return img.select('ST_B10').multiply(0.00341802).add(149.0 - 273.15).rename('lst').updateMask(clear);
}
var med = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(city).filterDate('2024-01-01', '2024-05-01').filter(ee.Filter.lt('CLOUD_COVER', 30))
  .map(lst).median().clip(city);
var inferno = ['000004', '4a0c6b', 'a52c60', 'ed6925', 'fcffa4'];
Map.addLayer(med, {min: 28, max: 46, palette: inferno}, 'LST mùa khô 2024 / dry-season LST', false);
var wc = ee.ImageCollection('ESA/WorldCover/v200').first();
print('LST trung bình theo lớp phủ (°C) / mean LST by land cover', ee.Dictionary.fromLists(
  ['trees', 'grass', 'crops', 'built-up', 'water'],
  [10, 30, 40, 50, 80].map(function (c) {
    return med.updateMask(wc.eq(c)).reduceRegion({reducer: ee.Reducer.mean(), geometry: city, scale: 100, maxPixels: 1e9}).get('lst');
  })));

// ---- 3. NO2 Sentinel-5P ----
var no2 = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2').select('tropospheric_NO2_column_number_density');
Map.addLayer(no2.filterDate('2024-01-01', '2025-01-01').mean().multiply(1e6),
  {min: 0, max: 120, palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']}, 'NO2 2024 (µmol/m²)', false);
var point = ee.Geometry.Point([105.85, 21.03]).buffer(10000);  // Hà Nội; đổi tùy ý / change freely
print(ui.Chart.image.series({imageCollection: no2.filterDate('2024-01-01', '2025-01-01').map(function (i) { return i.multiply(1e6).copyProperties(i, ['system:time_start']); }),
  region: point, reducer: ee.Reducer.mean(), scale: 1113}).setOptions({title: 'NO2 tầng đối lưu / tropospheric NO2 (µmol/m²)'}));
