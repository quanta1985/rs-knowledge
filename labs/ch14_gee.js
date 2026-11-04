/**
 * Lab 14 — Lọc, map, reduce trong Earth Engine / Filter, map, reduce in Earth Engine · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Contains modified Copernicus Sentinel data 2024.
 */

// ---- 1. Lọc / filter ----
var frame = ee.Geometry.Rectangle([583980, 2325900, 589100, 2331020], 'EPSG:32648', false);  // khung Hồ Tây / West Lake frame
var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(frame)
  .filterDate('2024-01-01', '2025-01-01').linkCollection(cs, ['cs_cdf']);
print('Số ảnh / images', col.size());
print('Mây tile ≤ 20 % / tile cloud ≤ 20 %', col.filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 20)).size());

// ---- 2. Độ trong của chính khung / clear share of the frame ----
var withClear = col.map(function (img) {
  var clear = img.select('cs_cdf').gte(0.6).reduceRegion({reducer: ee.Reducer.mean(), geometry: frame, scale: 20}).get('cs_cdf');
  return img.set('clear', clear);
});
print('Khung trong ≥ 90 % / frame clear ≥ 90 %', withClear.filter(ee.Filter.gte('clear', 0.9)).size());
print(ui.Chart.feature.byFeature(withClear, 'system:time_start', ['CLOUDY_PIXEL_PERCENTAGE', 'clear'])
  .setOptions({title: 'Mây tile (%) và độ trong của khung (0-1) / tile cloud (%) and frame clear (0-1)', pointSize: 3, lineWidth: 0}));

// ---- 3. map() + reduce ----
var ndvi = col.map(function (img) {
  return img.normalizedDifference(['B8', 'B4']).rename('ndvi').updateMask(img.select('cs_cdf').gte(0.6));
});
var brbg = ['543005', 'bf812d', 'f6e8c3', 'f5f5f5', 'c7eae5', '35978f', '003c30'];
Map.centerObject(frame, 14);
Map.setOptions('SATELLITE');
Map.addLayer(ndvi.median().clip(frame), {min: -1, max: 1, palette: brbg}, 'NDVI median');
Map.addLayer(ndvi.max().clip(frame), {min: -1, max: 1, palette: brbg}, 'NDVI max', false);
Map.addLayer(ndvi.count().clip(frame), {min: 10, max: 30, palette: ['440154', '21918c', 'fde725']}, 'Số quan sát / count', false);

// ---- 4. Xuất / export (bấm Run trong tab Tasks / press Run in the Tasks tab) ----
Export.image.toDrive({image: ndvi.median(), description: 'ndvi_median_2024_westlake', region: frame, scale: 10, crs: 'EPSG:32648'});
