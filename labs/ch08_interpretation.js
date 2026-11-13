/**
 * Lab 13 — Tổ hợp màu để giải đoán / Composites for interpretation · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Contains modified Copernicus Sentinel data.
 */

// ---- Đổi điểm và khoảng thời gian / change the point and period ----
var point = ee.Geometry.Point([105.005, 10.49]);   // Núi Cấm, An Giang; thử / try [108.215, 16.055] Đà Nẵng
var START = '2024-01-01', END = '2024-04-01';
var aoi = point.buffer(2560).bounds();

Map.centerObject(aoi, 14);
var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
// Ảnh trong nhất trong khoảng thời gian / clearest image in the period
var best = ee.Image(ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi).filterDate(START, END).linkCollection(cs, ['cs_cdf'])
  .map(function (img) {
    var f = img.select('cs_cdf').gte(0.6).reduceRegion(ee.Reducer.mean(), aoi, 20).get('cs_cdf');
    return img.set('clear', f);
  })
  .sort('clear', false).first()).clip(aoi);
print('Ảnh / image', best.get('system:index'), 'tỷ lệ trong / clear share', best.get('clear'));

var presets = [
  {name: 'Màu thật / true colour 4-3-2', bands: ['B4', 'B3', 'B2']},
  {name: 'Giả màu NIR / NIR false colour 8-4-3', bands: ['B8', 'B4', 'B3']},
  {name: 'Nông nghiệp / agriculture 11-8-2', bands: ['B11', 'B8', 'B2']},
  {name: 'Đô thị SWIR / urban 12-11-4', bands: ['B12', 'B11', 'B4']}
];
presets.forEach(function (p, i) {
  // Kéo giãn 2–98 % theo vùng / 2–98 % stretch over the area
  var pct = best.select(p.bands).reduceRegion({reducer: ee.Reducer.percentile([2, 98]), geometry: aoi, scale: 20, maxPixels: 1e8});
  pct.evaluate(function (d) {
    var mins = p.bands.map(function (b) { return d[b + '_p2']; });
    var maxs = p.bands.map(function (b) { return d[b + '_p98']; });
    Map.addLayer(best, {bands: p.bands, min: mins, max: maxs}, p.name, i === 0);
  });
});

// Kiểm tra "trông như nước": MNDWI > 0 là nước / check "looks like water": MNDWI > 0 is water
var mndwi = best.normalizedDifference(['B3', 'B11']).rename('MNDWI');
Map.addLayer(mndwi, {min: -0.8, max: 0.8, palette: ['8c510a', 'f5f5f5', '01665e']}, 'MNDWI', false);
Map.addLayer(mndwi.gt(0).selfMask(), {palette: '0072B2'}, 'Nước (MNDWI > 0) / water', false);
Map.onClick(function (c) {
  var v = mndwi.reduceRegion(ee.Reducer.first(), ee.Geometry.Point([c.lon, c.lat]), 10);
  print('MNDWI tại / at', c.lon.toFixed(4), c.lat.toFixed(4), v.get('MNDWI'));
});
