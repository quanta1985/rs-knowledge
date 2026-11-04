"""DEM for Chapter 12: Copernicus GLO-30 and SRTM over Fansipan – Sa Pa on one 30 m UTM 48N grid.

Usage:
    python -I scripts/data/export_ch12_dem.py

Output: public/data/ch12-fansipan/{bands.u16z, meta.json}, int16 metres (scale 1), bands `cop`, `srtm`.
Both DEMs are resampled bilinearly by Earth Engine onto the same grid (nearest would add staircase artefacts to slope).
"""
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import ee
import numpy as np

PROJECT = "claudev1-503808"
COP = "COPERNICUS/DEM/GLO30_2024_1"
CRS = "EPSG:32648"
ROOT = Path(__file__).resolve().parents[2]
N, RES = 600, 30
# frame centre between the Fansipan summit (103.775 E, 22.3033 N) and Sa Pa town; UTM 48N, snapped to 30 m
CX, CY = 377_000, 2_469_000
X0, Y1 = CX - N * RES // 2, CY + N * RES // 2


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ee.Initialize(project=PROJECT)
    col = ee.ImageCollection(COP).filterBounds(ee.Geometry.Point(103.775, 22.3033).buffer(20_000))
    # mosaic() drops the native 1-arcsecond projection; restore it before bilinear resampling
    cop = col.select("DEM").mosaic().setDefaultProjection(col.first().projection()).resample("bilinear").rename("cop")
    srtm = ee.Image("USGS/SRTMGL1_003").select("elevation").resample("bilinear").rename("srtm")
    stack = ee.Image.cat([cop, srtm]).round().toInt16()
    arr = ee.data.computePixels({
        "expression": stack, "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": N, "height": N}, "crsCode": CRS,
                 "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": X0, "shearY": 0, "scaleY": -RES, "translateY": Y1}},
    })
    names = ["cop", "srtm"]
    cube = np.stack([arr[b] for b in names]).astype("<i2")
    out = ROOT / "public/data/ch12-fansipan"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    meta = {
        "name": {"vi": "Fansipan – Sa Pa, Lào Cai", "en": "Fansipan – Sa Pa, Lao Cai"},
        "width": N, "height": N, "resolution_m": RES, "crs": CRS, "origin_xy": [X0, Y1],
        "bands": names, "dtype": "int16", "layout": "BSQ", "scale": 1, "unit": "m",
        "provenance": {
            "cop": "COPERNICUS/DEM/GLO30_2024_1 (Copernicus DEM GLO-30 release 2024_1, TanDEM-X 2011-2015, EGM2008 heights)",
            "srtm": "USGS/SRTMGL1_003 (SRTM 1 arc-second, Feb 2000, EGM96 heights)",
            "resampling": "bilinear onto a 30 m UTM 48N grid, rounded to whole metres",
            "script": "scripts/data/export_ch12_dem.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attribution": "Copernicus DEM © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the EU and ESA; SRTM courtesy NASA/USGS",
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    c, s = cube.astype(float)
    i = np.unravel_index(np.argmax(c), c.shape)
    print("size", (out / "bands.u16z").stat().st_size, "bytes")
    print("cop min/max", c.min(), c.max(), "at row/col", i, "srtm at same", s[i], "srtm max", s.max())
    d = c - s
    print("cop-srtm mean %.2f sd %.2f p5 %.1f p95 %.1f" % (d.mean(), d.std(), *np.percentile(d, [5, 95])))


if __name__ == "__main__":
    main()
