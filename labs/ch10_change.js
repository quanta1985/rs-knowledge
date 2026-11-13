/**
 * Lab 15 — Năm NDVI giảm mạnh nhất / Year of largest NDVI drop · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Landsat courtesy of the U.S. Geological Survey.
 */

// ---- Thông số / parameters ----
var aoi = ee.Geometry.Rectangle([105.70, 20.94, 105.85, 21.07]);  // Tây Hà Nội; đổi tùy ý / change freely
var FIRST = 2000, LAST = 2024, MIN_DROP = 0.3;

Map.centerObject(aoi, 12);
Map.setOptions('SATELLITE');

function prep(names) {
  return function (img) {
    var qa = img.select('QA_PIXEL');
    var clear = qa.bitwiseAnd(2).eq(0).and(qa.bitwiseAnd(8).eq(0)).and(qa.bitwiseAnd(16).eq(0)); // bits 1, 3, 4
    return img.select(names, ['red', 'nir']).multiply(0.0000275).add(-0.2).updateMask(clear);
  };
}
function annualNdvi(y) {
  var s = ee.Date.fromYMD(y, 1, 1), e = s.advance(1, 'year');
  var old = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2').merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2'))
    .filterBounds(aoi).filterDate(s, e).map(prep(['SR_B3', 'SR_B4']));
  var neu = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
    .filterBounds(aoi).filterDate(s, e).map(prep(['SR_B4', 'SR_B5']));
  return old.merge(neu).map(function (i) { return i.normalizedDifference(['nir', 'red']); }).median().rename('ndvi');
}

var years = ee.List.sequence(FIRST + 1, LAST);
var drops = ee.ImageCollection(years.map(function (y) {
  y = ee.Number(y);
  var d = annualNdvi(y.subtract(1)).subtract(annualNdvi(y)).rename('drop');
  return d.addBands(ee.Image.constant(y).toFloat().rename('year'));
}));
var best = drops.qualityMosaic('drop').clip(aoi);
var yearOfDrop = best.select('year').updateMask(best.select('drop').gt(MIN_DROP));

Map.addLayer(annualNdvi(FIRST).clip(aoi), {min: -0.2, max: 0.8, palette: ['8c510a', 'f6e8c3', '01665e']}, 'NDVI ' + FIRST, false);
Map.addLayer(annualNdvi(LAST).clip(aoi), {min: -0.2, max: 0.8, palette: ['8c510a', 'f6e8c3', '01665e']}, 'NDVI ' + LAST, false);
Map.addLayer(yearOfDrop, {min: FIRST + 1, max: LAST, palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']}, 'Năm giảm NDVI / year of drop');

print(ui.Chart.image.histogram({image: yearOfDrop, region: aoi, scale: 30, minBucketWidth: 1})
  .setOptions({title: 'Số pixel theo năm giảm NDVI / pixels per year of drop', hAxis: {title: 'năm / year'}, legend: {position: 'none'}}));

// Bấm bản đồ để xem chuỗi NDVI / click the map to chart the NDVI series
Map.onClick(function (c) {
  var pt = ee.Geometry.Point([c.lon, c.lat]);
  var series = ee.ImageCollection(ee.List.sequence(FIRST, LAST).map(function (y) {
    return annualNdvi(ee.Number(y)).set('system:time_start', ee.Date.fromYMD(ee.Number(y), 7, 1).millis());
  }));
  print(ui.Chart.image.series(series, pt, ee.Reducer.first(), 30).setOptions({title: 'NDVI năm tại / annual NDVI at ' + c.lon.toFixed(4) + ', ' + c.lat.toFixed(4)}));
});
