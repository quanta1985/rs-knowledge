/**
 * Lab 17 — Mô hình số độ cao / Elevation models · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Copernicus DEM © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS
 * by the EU and ESA; SRTM courtesy NASA/USGS.
 */

// ---- Vùng / area: đổi tùy ý / change freely ----
var center = ee.Geometry.Point([103.81, 22.33]);       // Fansipan – Sa Pa; thử / try [106.2, 17.5] Phong Nha
var aoi = center.buffer(9000).bounds();
Map.centerObject(aoi, 12);

// Copernicus: mosaic() mất phép chiếu gốc, phải gán lại / mosaic() drops the native projection
var col = ee.ImageCollection('COPERNICUS/DEM/GLO30_2024_1').filterBounds(aoi);
var cop = col.select('DEM').mosaic().setDefaultProjection(col.first().projection()).clip(aoi);
var srtm = ee.Image('USGS/SRTMGL1_003').select('elevation').clip(aoi);

var terrain = ['266E4D', '78A050', 'DECD80', 'AB7846', '785A4B', 'EBE8E4'];
var stats = cop.reduceRegion({reducer: ee.Reducer.minMax(), geometry: aoi, scale: 30});
print('Độ cao / elevation min-max (m)', stats);

Map.addLayer(ee.Terrain.hillshade(cop, 315, 45), {min: 0, max: 255}, 'Bóng đổ / hillshade');
Map.addLayer(cop, {min: 600, max: 3100, palette: terrain, opacity: 0.6}, 'Độ cao / elevation');
var slope = ee.Terrain.slope(cop);
Map.addLayer(slope, {min: 0, max: 60, palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']}, 'Độ dốc / slope', false);
Map.addLayer(cop.subtract(srtm), {min: -30, max: 30, palette: ['8c510a', 'f6e8c3', 'f5f5f5', 'c7eae5', '01665e']}, 'Copernicus − SRTM', false);

var steep = slope.gt(30).reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 30});
print('Tỷ lệ dốc > 30° / share steeper than 30°', steep);

// ---- Chồng lấn / bóng radar cho Sentinel-1 (θ = 37°) / layover and shadow ----
var THETA = 37, LOOK = 77.6;   // bay lên ở ~22°N; bay xuống dùng 282.4 / ascending; use 282.4 for descending
var aspect = ee.Terrain.aspect(cop);
var ar = slope.multiply(Math.PI / 180).tan()
  .multiply(aspect.subtract(LOOK + 180).multiply(Math.PI / 180).cos()).atan().multiply(180 / Math.PI);
var layover = ar.gte(THETA), shadow = ar.multiply(-1).gt(90 - THETA);
Map.addLayer(layover.selfMask(), {palette: 'D55E00'}, 'Chồng lấn / layover', false);
Map.addLayer(shadow.selfMask(), {palette: '000000'}, 'Bóng radar / shadow', false);
print('Chồng lấn / layover share', layover.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 30}));

// ---- Mặt cắt / profile: đỉnh Fansipan → Sa Pa ----
var line = ee.Geometry.LineString([[103.775, 22.3033], [103.844, 22.336]]);
var pts = ee.FeatureCollection(ee.List.sequence(0, 1, 1 / 120).map(function (t) {
  var p = ee.Geometry.Point(ee.List([ee.Number(103.775).add(ee.Number(t).multiply(0.069)), ee.Number(22.3033).add(ee.Number(t).multiply(0.0327))]));
  return ee.Feature(p, {t: t});
}));
var prof = cop.rename('cop').addBands(srtm.rename('srtm')).sampleRegions({collection: pts, scale: 30, geometries: false});
print(ui.Chart.feature.byFeature(prof, 't', ['cop', 'srtm']).setOptions({title: 'Mặt cắt / profile', vAxis: {title: 'm'}}));
Map.addLayer(line, {color: 'ffffff'}, 'Tuyến / line');
