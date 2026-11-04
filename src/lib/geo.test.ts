import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridCorners, lonLatToPixel, utmToLonLat } from './geo.ts';

// Reference: Earth Engine ee.Geometry.MultiPoint(..., EPSG:32648).transform('EPSG:4326', 0.001)
const GEE: [number, number][] = [
  [105.80845515485319, 21.078241745030187], [105.85774009975263, 21.077999835966203],
  [105.85747509473, 21.031742821893975], [105.80820537260801, 21.031984150897294],
];

test('inverse UTM matches Earth Engine to better than 1e-6 deg (~0.1 m)', () => {
  const q = gridCorners(583980, 2331020, 512, 512, 10, 48);
  q.forEach(([lon, lat], i) => {
    assert.ok(Math.abs(lon - GEE[i][0]) < 1e-6, `lon ${i}: ${lon} vs ${GEE[i][0]}`);
    assert.ok(Math.abs(lat - GEE[i][1]) < 1e-6, `lat ${i}: ${lat} vs ${GEE[i][1]}`);
  });
});

test('central meridian maps to the zone longitude', () => {
  const [lon] = utmToLonLat(500000, 2331020, 48);
  assert.ok(Math.abs(lon - 105) < 1e-9);
});

test('lonLatToPixel inverts the corner quad', () => {
  const q = gridCorners(583980, 2331020, 512, 512, 10, 48);
  const centre = utmToLonLat(583980 + 160 * 10 + 5, 2331020 - 300 * 10 - 5, 48); // West Lake reference pixel centre
  assert.deepEqual(lonLatToPixel(q, centre[0], centre[1], 512, 512), { row: 300, col: 160 });
  assert.equal(lonLatToPixel(q, 105.7, 21.05, 512, 512), null);
});
