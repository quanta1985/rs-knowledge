/**
 * Lab 2 — Sentinel-2 chụp Việt Nam trong 10 ngày / Sentinel-2 over Viet Nam in 10 days · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run. / Paste into the Code Editor and press Run.
 *
 * Contains modified Copernicus Sentinel data.
 */
var vn = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017').filter(ee.Filter.eq('country_na', 'Vietnam'));
var start = ee.Date('2024-01-01');
var DAYS = 10;
Map.centerObject(vn, 5);

var palette = ['440154', '482878', '3e4989', '31688e', '26828e', '1f9e89', '35b779', '6ece58', 'b5de2b', 'fde725'];
for (var d = 0; d < DAYS; d++) {
  var day = start.advance(d, 'day');
  var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(vn).filterDate(day, day.advance(1, 'day'));
  var fps = col.map(function (img) { return ee.Feature(ee.Geometry(img.get('system:footprint'))); });
  Map.addLayer(ee.FeatureCollection(fps).style({color: palette[d], fillColor: palette[d] + '55', width: 1}), {}, 'Ngày / day ' + (d + 1), true);
  print('Ngày / day ' + (d + 1), day.format('YYYY-MM-dd'), 'số ô / tiles:', col.size());
}
Map.addLayer(vn.style({color: 'white', fillColor: '00000000', width: 1}), {}, 'Việt Nam (LSIB)');
