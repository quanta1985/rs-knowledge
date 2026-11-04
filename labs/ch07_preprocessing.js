/**
 * Lab 7 — Ảnh tổng hợp không mây / Cloud-free composite · Sổ tay Viễn thám & GIS
 * Dán vào https://code.earthengine.google.com và bấm Run.
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * Contains modified Copernicus Sentinel data.
 */

// ---- Thông số / parameters ----
var aoi = ee.Geometry.Rectangle([105.80, 21.03, 105.86, 21.08]);  // Hồ Tây, Hà Nội
var START = '2023-08-21', END = '2023-11-20';
var CLEAR = 0.6;                                                   // ngưỡng cs_cdf / cs_cdf threshold

Map.centerObject(aoi, 14);
var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi).filterDate(START, END)
  .linkCollection(cs, ['cs_cdf']);
print('Số ảnh / images', col.size());

var vis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000};
// Trung vị không lọc mây / median without masking
Map.addLayer(col.median().clip(aoi), vis, 'Trung vị, không lọc / median, unmasked', false);
// Lọc mây rồi lấy trung vị / mask, then median
var masked = col.map(function (img) { return img.updateMask(img.select('cs_cdf').gte(CLEAR)); });
Map.addLayer(masked.median().clip(aoi), vis, 'Trung vị sau lọc mây / median, masked');
Map.addLayer(masked.select('B4').count().clip(aoi), {min: 0, max: 19, palette: ['440154', '21918c', 'fde725']}, 'Số ảnh trong / clear looks', false);

// Một ngày nhiều mây và hai mặt nạ / one cloudy day and two masks
var day = ee.Image(col.filterDate('2023-10-05', '2023-10-06').first());
Map.addLayer(day.clip(aoi), vis, 'Ảnh 05/10/2023', false);
Map.addLayer(day.select('cs_cdf').lt(CLEAR).selfMask().clip(aoi), {palette: 'CC79A7'}, 'Mây theo Cloud Score+', false);
var scl = day.select('SCL');
Map.addLayer(scl.eq(3).or(scl.eq(8)).or(scl.eq(9)).or(scl.eq(10)).selfMask().clip(aoi), {palette: 'E69F00'}, 'Mây theo SCL', false);

// Từ phản xạ TOA tới bức xạ / TOA reflectance to radiance (L1C)
var l1c = ee.Image('COPERNICUS/S2_HARMONIZED/20240212T032849_20240212T033821_T48QWJ');
var U = ee.Number(l1c.get('REFLECTANCE_CONVERSION_CORRECTION'));
var E = ee.Number(l1c.get('SOLAR_IRRADIANCE_B2'));
var cosz = ee.Number(l1c.get('MEAN_SOLAR_ZENITH_ANGLE')).multiply(Math.PI / 180).cos();
var radianceB2 = l1c.select('B2').divide(10000).multiply(U.multiply(E).multiply(cosz).divide(Math.PI));
Map.addLayer(radianceB2.clip(aoi), {min: 40, max: 120}, 'Bức xạ B2 / B2 radiance (W m-2 sr-1 um-1)', false);
print('U, E(B2), cos θs', U, E, cosz);
