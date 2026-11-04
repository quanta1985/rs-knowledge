import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmForward, utmForward, wgs84ToVn2000, vn2000ToWgs84, scaleFactor } from './crs.ts';

// References: pyproj 3.7 / PROJ with the EPSG database (EPSG:32648, EPSG:4756 via EPSG:6960, EPSG:5897, EPSG:3405).
const HOAN_KIEM = { lon: 105.8342, lat: 21.0278 };

test('UTM 48N forward matches PROJ to 1 cm', () => {
  const u = utmForward(HOAN_KIEM.lon, HOAN_KIEM.lat);
  assert.equal(u.zone, 48);
  assert.ok(Math.abs(u.e - 586683.642) < 0.01 && Math.abs(u.n - 2325450.786) < 0.01, `${u.e} ${u.n}`);
  const b = utmForward(106.698, 10.7725);
  assert.ok(Math.abs(b.e - 685662.284) < 0.01 && Math.abs(b.n - 1191339.161) < 0.01, `${b.e} ${b.n}`);
});

test('WGS84 -> VN-2000 geographic matches EPSG:6960 (inverse) to 1e-8 deg', () => {
  const [lon, lat] = wgs84ToVn2000(HOAN_KIEM.lon, HOAN_KIEM.lat);
  assert.ok(Math.abs(lon - 105.832317307) < 1e-8 && Math.abs(lat - 21.028785769) < 1e-8, `${lon} ${lat}`);
  const [lon2, lat2] = vn2000ToWgs84(lon, lat);
  assert.ok(Math.abs(lon2 - HOAN_KIEM.lon) < 1e-8 && Math.abs(lat2 - HOAN_KIEM.lat) < 1e-8); // round trip within 1 mm (small-angle inverse)
});

test('VN-2000 TM-3 (105 deg, k0 0.9999) and VN-2000 UTM match PROJ to 1 cm', () => {
  const [lon, lat] = wgs84ToVn2000(HOAN_KIEM.lon, HOAN_KIEM.lat);
  const t = tmForward(lon, lat, 105, 0.9999);
  assert.ok(Math.abs(t.e - 586513.385) < 0.01 && Math.abs(t.n - 2326256.818) < 0.01, `${t.e} ${t.n}`);
  const u = tmForward(lon, lat, 105, 0.9996);
  assert.ok(Math.abs(u.e - 586487.428) < 0.01 && Math.abs(u.n - 2325558.872) < 0.01, `${u.e} ${u.n}`);
});

test('scale factor is k0 on the central meridian and grows away from it', () => {
  assert.ok(Math.abs(scaleFactor(105, 21, 105, 0.9996) - 0.9996) < 1e-12);
  assert.ok(scaleFactor(108, 21, 105, 0.9996) > 1.0003);
});
