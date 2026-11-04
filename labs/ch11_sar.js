/**
 * Lab 11 — Bản đồ ngập từ Sentinel-1 / Sentinel-1 flood mapping · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Contains modified Copernicus Sentinel data.
 */

// ---- Thông số / parameters: đổi vùng và ngày tùy ý / change area and dates freely ----
var aoi = ee.Geometry.Rectangle([105.78, 21.00, 105.92, 21.10]);  // Hà Nội, sông Hồng
var BEFORE = '2024-08-31', AFTER = '2024-09-12';                  // trước / sau bão Yagi
var ORBIT = 91;                                                    // cùng quỹ đạo! / same relative orbit!
var THRESHOLD = -15, DROP = -3;                                    // dB

Map.centerObject(aoi, 13);
Map.setOptions('SATELLITE');

function s1(day) {
  var d = ee.Date(day);
  return ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi).filterDate(d, d.advance(1, 'day'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq('relativeOrbitNumber_start', ORBIT))
    .mosaic().select('VV').clip(aoi);
}

// Lọc trung bình 5x5 trong công suất tuyến tính / 5x5 mean filter in linear power
function smooth(db) {
  var lin = ee.Image(10).pow(db.divide(10));
  return lin.focalMean({radius: 2, kernelType: 'square', units: 'pixels'}).log10().multiply(10);
}

var pre = smooth(s1(BEFORE)), post = smooth(s1(AFTER));
var waterBefore = pre.lt(THRESHOLD);
var newThr = waterBefore.not().and(post.lt(THRESHOLD));
var newDiff = waterBefore.not().and(post.subtract(pre).lt(DROP));

Map.addLayer(pre, {min: -25, max: 5}, 'VV trước / before', false);
Map.addLayer(post, {min: -25, max: 5}, 'VV sau / after', false);
Map.addLayer(post.subtract(pre), {min: -10, max: 10, palette: ['b2182b', 'f7f7f7', '2166ac']}, 'VV sau − trước', false);
Map.addLayer(waterBefore.selfMask(), {palette: '0072B2'}, 'Nước trước / water before');
Map.addLayer(newThr.selfMask(), {palette: 'E69F00'}, 'Nước mới (ngưỡng) / new water (threshold)');
Map.addLayer(newDiff.selfMask(), {palette: 'D55E00'}, 'Nước mới (thay đổi) / new water (change)', false);

function km2(mask, label) {
  var a = mask.multiply(ee.Image.pixelArea()).reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e9});
  print(label, ee.Number(a.values().get(0)).divide(1e6), 'km²');
}
km2(waterBefore, 'Nước trước / water before');
km2(newThr, 'Nước mới, ngưỡng / new water, threshold');
km2(newDiff, 'Nước mới, thay đổi / new water, change');

// Histogram VV sau để chọn ngưỡng / VV histogram of the post image
print(ui.Chart.image.histogram({image: post, region: aoi, scale: 20, maxBuckets: 120})
  .setOptions({title: 'VV sau / after (dB)', hAxis: {title: 'dB'}, legend: {position: 'none'}}));
