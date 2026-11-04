/**
 * Lab 1 — Khung ảnh và số ảnh / Scene footprints and image counts · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run. / Paste into the Code Editor and press Run.
 *
 * Contains modified Copernicus Sentinel data; Landsat courtesy of USGS.
 */
var point = ee.Geometry.Point([105.83, 21.05]);   // Hà Nội — đổi sang nơi của bạn / change to your place
var start = '2024-01-01', end = '2025-01-01';
Map.centerObject(point, 7);
Map.setOptions('SATELLITE');

var sets = [
  {name: 'Sentinel-2 L2A', color: '009E73', col: ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')},
  {name: 'Landsat 9 L2', color: 'E69F00', col: ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')},
  {name: 'Sentinel-1 GRD IW', color: '56B4E9', col: ee.ImageCollection('COPERNICUS/S1_GRD').filter(ee.Filter.eq('instrumentMode', 'IW'))}
];

sets.forEach(function (s) {
  var c = s.col.filterBounds(point).filterDate(start, end);
  print(s.name, 'số ảnh / images:', c.size());
  // khung của ảnh đầu tiên và diện tích / footprint of the first image and its area
  var fp = ee.Geometry(c.first().get('system:footprint'));
  var poly = ee.Geometry.Polygon(fp.coordinates());
  print(s.name, 'diện tích một cảnh / scene area (km²):', poly.area(1000).divide(1e6));
  Map.addLayer(ee.FeatureCollection([ee.Feature(poly)]).style({color: s.color, fillColor: s.color + '22', width: 2}), {}, s.name);
});
Map.addLayer(point, {color: 'red'}, 'Điểm / point');
