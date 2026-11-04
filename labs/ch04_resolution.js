/**
 * Lab 4 — Bốn loại độ phân giải / The four resolutions · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Contains modified Copernicus Sentinel data; Landsat courtesy of USGS; MODIS courtesy of NASA LP DAAC.
 */

// ---- 1. Cùng khung Hồ Tây, bốn sản phẩm / same West Lake frame, four products ----
var frame = ee.Geometry.Rectangle([583980, 2325900, 589100, 2331020], 'EPSG:32648', false);
Map.centerObject(frame, 14);

function ndvi(img) { return img.normalizedDifference(['nir', 'red']).rename('ndvi'); }
var products = [
  {name: 'Sentinel-2 10 m (2024-02-12)', res: 10,
   img: ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ').select(['B4', 'B8'], ['red', 'nir'])},
  {name: 'Landsat 9 30 m (2023-12-22)', res: 30,
   img: ee.Image('LANDSAT/LC09/C02/T1_L2/LC09_127045_20231222').select(['SR_B4', 'SR_B5'], ['red', 'nir']).multiply(0.0000275).add(-0.2)},
  {name: 'MODIS 250 m (2023-12-07)', res: 250,
   img: ee.Image('MODIS/061/MOD09GQ/2023_12_07').select(['sur_refl_b01', 'sur_refl_b02'], ['red', 'nir'])},
  {name: 'MODIS 500 m (2023-12-07)', res: 500,
   img: ee.Image('MODIS/061/MOD09GA/2023_12_07').select(['sur_refl_b01', 'sur_refl_b02'], ['red', 'nir'])}
];
var brbg = ['543005', 'bf812d', 'f6e8c3', 'f5f5f5', 'c7eae5', '35978f', '003c30'];

products.forEach(function (p, i) {
  // reproject: hiển thị đúng kích thước pixel gốc / show the native pixel size
  var v = ndvi(p.img).reproject({crs: 'EPSG:32648', scale: p.res}).clip(frame);
  Map.addLayer(v, {min: -1, max: 1, palette: brbg}, 'NDVI ' + p.name, i === 0);
  var km2 = v.lt(0).multiply(ee.Image.pixelArea()).divide(1e6)
    .reduceRegion({reducer: ee.Reducer.sum(), geometry: frame, scale: p.res, crs: 'EPSG:32648'}).getNumber('ndvi');
  print(p.name + ' — NDVI < 0 (km²)', km2);
});

// ---- 2. Ảnh dùng được theo tháng / usable images per month ----
// Đổi điểm / change the point: An Giang = [105.08, 10.45]
var point = ee.Geometry.Point([105.833, 21.055]);
var box = point.buffer(1000).bounds();
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(box).filterDate('2022-01-01', '2025-01-01')
  .linkCollection(ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED'), ['cs_cdf']);

var perImage = s2.map(function (img) {
  var clear = img.select('cs_cdf').gte(0.6).reduceRegion(ee.Reducer.mean(), box, 20).getNumber('cs_cdf');
  return ee.Feature(null, {month: img.date().get('month'), date: img.date().format('YYYY-MM-dd'), clear: clear});
}).filter(ee.Filter.notNull(['clear']));
// gộp tile cùng ngày, giữ tile trong nhất / merge same-day tiles, keep the clearest
var perDay = ee.FeatureCollection(perImage.distinct('date').map(function (f) {
  var best = perImage.filter(ee.Filter.eq('date', f.get('date'))).aggregate_max('clear');
  return f.set('clear', best);
}));

var months = ee.List.sequence(1, 12);
var stats = ee.FeatureCollection(months.map(function (m) {
  var inMonth = perDay.filter(ee.Filter.eq('month', m));
  return ee.Feature(null, {
    month: m,
    acquisitions: ee.Number(inMonth.size()).divide(3),
    usable: ee.Number(inMonth.filter(ee.Filter.gte('clear', 0.9)).size()).divide(3)
  });
}));
print(ui.Chart.feature.byFeature(stats, 'month', ['acquisitions', 'usable'])
  .setChartType('ColumnChart')
  .setOptions({title: 'Sentinel-2 2022–2024: ảnh mỗi tháng / images per month (per year)',
               hAxis: {title: 'Tháng / month'}, vAxis: {title: 'Ảnh / images'},
               colors: ['#cccccc', '#0072B2']}));
