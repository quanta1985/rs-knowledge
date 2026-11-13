/**
 * Lab 10 — Múi UTM và vector hóa một hồ / UTM zones and vectorising a lake · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Contains modified Copernicus Sentinel data.
 */

// ---- 1. Múi UTM 48, 49 trên Việt Nam / UTM zones 48 and 49 over Viet Nam ----
function meridian(lon, color) {
  return ee.Feature(ee.Geometry.LineString([[lon, 6], [lon, 24.5]], null, false), {color: color});
}
var lines = ee.FeatureCollection([meridian(102, 'ffffff'), meridian(108, 'ffffff'), meridian(114, 'ffffff'),
                                  meridian(105, 'E69F00'), meridian(111, 'E69F00')]);
Map.setCenter(106, 16, 5);
Map.setOptions('SATELLITE');
Map.addLayer(lines.style({styleProperty: 'color', width: 2}), {}, 'Múi UTM / UTM zones (trắng = biên, cam = kinh tuyến trục)');

// ---- 2. Một hồ: raster -> vector / one lake: raster -> vector ----
var LAKE_POINT = ee.Geometry.Point([105.8205, 21.0525]);   // Hồ Tây; thử hồ khác / try another lake
var aoi = LAKE_POINT.buffer(4000).bounds();
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(aoi)
  .filterDate('2024-01-01', '2024-04-30').sort('CLOUDY_PIXEL_PERCENTAGE').first();
var water = s2.normalizedDifference(['B3', 'B11']).gte(0).selfMask().clip(aoi);
var vec = water.reduceToVectors({geometry: aoi, crs: 'EPSG:32648', scale: 10, geometryType: 'polygon',
                                 eightConnected: true, maxPixels: 1e9});
var lake = vec.filterBounds(LAKE_POINT).first().geometry();

Map.centerObject(LAKE_POINT, 14);
Map.addLayer(water, {palette: '0072B2'}, 'Raster: MNDWI >= 0');
Map.addLayer(ee.FeatureCollection(lake).style({color: 'E69F00', fillColor: '00000000', width: 2}), {}, 'Vector');
Map.addLayer(ee.FeatureCollection(lake.simplify({maxError: 50, proj: 'EPSG:32648'}))
  .style({color: 'f7867a', fillColor: '00000000', width: 2}), {}, 'Vector simplify 50 m', false);

var px = water.clip(lake).multiply(ee.Image.pixelArea()).reduceRegion({reducer: ee.Reducer.sum(), geometry: lake, scale: 10, crs: 'EPSG:32648'});
print('Ngày ảnh / image date', s2.date());
print('Diện tích pixel / pixel area (km²)', ee.Number(px.values().get(0)).divide(1e6));
print('Diện tích vector / vector area (km²)', lake.area({maxError: 1, proj: 'EPSG:32648'}).divide(1e6));
print('Số đỉnh / vertices', ee.List(lake.coordinates()).flatten().length().divide(2));
