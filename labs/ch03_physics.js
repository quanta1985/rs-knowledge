/**
 * Lab 3 — Nhiệt độ bề mặt từ Landsat 9 / Landsat 9 surface temperature · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run. / Paste into the Code Editor and press Run.
 *
 * Landsat courtesy of USGS.
 */
var aoi = ee.Geometry.Rectangle([105.78, 21.00, 105.90, 21.10]);   // Hồ Tây – sông Hồng
var start = '2023-12-01', end = '2024-01-01';                        // đổi sang mùa hè để so sánh / try a summer month
Map.centerObject(aoi, 13);
Map.setOptions('SATELLITE');

var col = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').filterBounds(aoi).filterDate(start, end)
  .filter(ee.Filter.lt('CLOUD_COVER', 20)).sort('CLOUD_COVER');
print('Cảnh / scenes:', col.aggregate_array('LANDSAT_PRODUCT_ID'));
var img = ee.Image(col.first());
var lst = img.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15).rename('LST_C');
var vis = {min: 14, max: 24, palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']};
Map.addLayer(lst.clip(aoi), vis, 'Nhiệt độ bề mặt / surface temperature (°C)');

// Wien: bước sóng phát xạ cực đại / peak emission wavelength (µm)
var wien = ee.Image.constant(2897.77).divide(lst.add(273.15)).rename('lambda_max_um');
print('Thống kê / stats (°C):', lst.reduceRegion({reducer: ee.Reducer.percentile([2, 50, 98]), geometry: aoi, scale: 30}));
print('λmax trung vị / median (µm):', wien.reduceRegion({reducer: ee.Reducer.median(), geometry: aoi, scale: 30}));
print(ui.Chart.image.histogram({image: lst, region: aoi, scale: 30, maxBuckets: 60}).setOptions({title: 'LST (°C)'}));
