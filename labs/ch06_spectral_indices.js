/**
 * Lab 6 — Chỉ số phổ / Spectral indices · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Cảnh / scene: Sentinel-2B L2A, 2024-02-12, Hồ Tây – sông Hồng, Hà Nội.
 * Contains modified Copernicus Sentinel data (2024).
 */

// 1. Khung 5,12 × 5,12 km giống sổ tay / the handbook's 5.12 × 5.12 km frame (UTM 48N)
var aoi = ee.Geometry.Rectangle([583980, 2325900, 589100, 2331020], 'EPSG:32648', false);
var img = ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ')
  .select(['B2', 'B3', 'B4', 'B8', 'B11'])
  .divide(10000)               // DN -> phản xạ / reflectance
  .clip(aoi);

Map.centerObject(aoi, 14);

// 2. Tổ hợp màu: kéo giãn 2–98 % / composites with a 2–98 % stretch
function stretchVis(image, bands) {
  var p = image.select(bands).reduceRegion({
    reducer: ee.Reducer.percentile([2, 98]), geometry: aoi, scale: 10, maxPixels: 1e8
  });
  return {
    bands: bands,
    min: bands.map(function (b) { return p.getNumber(b + '_p2'); }).map(function (n) { return n.getInfo(); }),
    max: bands.map(function (b) { return p.getNumber(b + '_p98'); }).map(function (n) { return n.getInfo(); })
  };
}
Map.addLayer(img, stretchVis(img, ['B4', 'B3', 'B2']), 'Màu thật / True colour', false);
Map.addLayer(img, stretchVis(img, ['B8', 'B4', 'B3']), 'Hồng ngoại giả / False colour');

// 3. Chỉ số / indices — normalizedDifference(['A','B']) = (A − B) / (A + B)
var idx = ee.Image.cat([
  img.normalizedDifference(['B8', 'B4']).rename('NDVI'),
  img.normalizedDifference(['B3', 'B8']).rename('NDWI'),
  img.normalizedDifference(['B3', 'B11']).rename('MNDWI'),
  img.normalizedDifference(['B11', 'B8']).rename('NDBI')
]);
var brbg = ['543005', '8c510a', 'bf812d', 'dfc27d', 'f6e8c3', 'f5f5f5',
            'c7eae5', '80cdc1', '35978f', '01665e', '003c30'];
['NDVI', 'NDWI', 'MNDWI', 'NDBI'].forEach(function (name) {
  Map.addLayer(idx.select(name), {min: -1, max: 1, palette: brbg}, name, name === 'NDVI');
});

// 4. Histogram MNDWI / NDWI
['NDWI', 'MNDWI'].forEach(function (name) {
  print(ui.Chart.image.histogram({image: idx.select(name), region: aoi, scale: 10, minBucketWidth: 0.02})
    .setOptions({title: name + ' histogram', hAxis: {title: name}, vAxis: {title: 'Số pixel / pixels'}, legend: {position: 'none'}}));
});

// 5. Diện tích nước tại ngưỡng t / water area at threshold t
function waterArea(name, t) {
  var km2 = idx.select(name).gte(t).multiply(ee.Image.pixelArea()).divide(1e6)
    .reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e8})
    .getNumber(name);
  print(name + ' ≥ ' + t + ' → km²', km2);
  Map.addLayer(idx.select(name).gte(t).selfMask(), {palette: ['009eff']}, name + ' ≥ ' + t, false);
}
waterArea('NDWI', 0.4);    // bỏ sót Hồ Tây / misses most of West Lake (~1.55 km²)
waterArea('MNDWI', 0.4);   // ~6.7 km²
waterArea('MNDWI', 0.10);  // ngưỡng Otsu trong sổ tay / the handbook's Otsu threshold (~7.2 km²)

// Bài tập: đổi ngày ảnh sang mùa mưa và so sánh diện tích nước sông Hồng.
// Exercise: switch to a wet-season scene and compare the Red River's water area.
