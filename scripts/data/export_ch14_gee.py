"""Data for Chapter 14 (Earth Engine): every Sentinel-2 acquisition over the Hanoi frame in 2024.

Usage:
    python -I scripts/data/export_ch14_gee.py

Outputs:
    public/data/ch14-catalog.json      one row per acquisition date: spacecraft, tiles, scene cloud %, clear share of the frame
    public/data/ch14-ndvi/{meta.json, bands.u16z}
        NDVI of every 2024 acquisition date on a 40 m grid of the same 5.12 km frame (int16 NDVI x 10000,
        -32768 where Cloud Score+ cs_cdf < 0.6), so reducers can be run in the browser.
"""
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import ee
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2] / "public/data"
X0, Y1, SIZE, RES = 583980, 2331020, 5120, 40
CLEAR = 0.6

ee.Initialize(project="claudev1-503808")
frame = ee.Geometry.Rectangle([X0, Y1 - SIZE, X0 + SIZE, Y1], ee.Projection("EPSG:32648"), False)
cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(frame).filterDate("2024-01-01", "2025-01-01")
       .linkCollection(cs, ["cs_cdf"]))


def row(img):
    clear = img.select("cs_cdf").gte(CLEAR).reduceRegion(ee.Reducer.mean(), frame, 20).get("cs_cdf")
    return ee.Feature(None, {"date": img.date().format("YYYY-MM-dd"), "sat": img.get("SPACECRAFT_NAME"),
                             "tile": img.get("MGRS_TILE"), "cloud": img.get("CLOUDY_PIXEL_PERCENTAGE"), "clear": clear})


rows = [f["properties"] for f in col.map(row).getInfo()["features"]]
by = {}
for r in rows:  # one row per date: tiles of the same overpass are merged (max clear share = best tile over the frame)
    d = by.setdefault(r["date"], {"date": r["date"], "sat": r["sat"], "tiles": [], "cloud": [], "clear": 0.0})
    d["tiles"].append(r["tile"])
    d["cloud"].append(round(r["cloud"], 1))
    d["clear"] = max(d["clear"], round(r["clear"] or 0, 3))
dates = sorted(by)
out = [{**by[d], "tiles": sorted(set(by[d]["tiles"])), "cloud": min(by[d]["cloud"])} for d in dates]
(ROOT / "ch14-catalog.json").write_text(json.dumps({
    "frame": "Hanoi West Lake – Red River, 5.12 x 5.12 km, UTM 48N", "year": 2024, "clear_threshold": CLEAR,
    "images": len(rows), "dates": out,
    "provenance": {"collection": "COPERNICUS/S2_SR_HARMONIZED filterBounds(frame) 2024, linked to GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
                   "cloud": "CLOUDY_PIXEL_PERCENTAGE of the 100 km tile (min over same-day tiles)",
                   "clear": f"share of the frame with cs_cdf >= {CLEAR} (max over same-day tiles)",
                   "script": "scripts/data/export_ch14_gee.py", "exported": datetime.now(timezone.utc).isoformat(timespec="seconds")},
}, ensure_ascii=False, indent=1), "utf-8")
print(len(rows), "images,", len(out), "dates")

# NDVI stack, one band per date (same-day tiles mosaicked)
n = SIZE // RES
grid = {"dimensions": {"width": n, "height": n}, "crsCode": "EPSG:32648",
        "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": X0, "shearY": 0, "scaleY": -RES, "translateY": Y1}}
bands = []
for d in dates:
    day = col.filterDate(d, ee.Date(d).advance(1, "day"))
    img = day.map(lambda i: i.normalizedDifference(["B8", "B4"]).rename("ndvi").updateMask(i.select("cs_cdf").gte(CLEAR))).mosaic()
    # 40 m = mean of 4x4 10 m pixels (only clear ones)
    img = img.setDefaultProjection("EPSG:32648", None, 10).reduceResolution(ee.Reducer.mean(), maxPixels=64)
    arr = ee.data.computePixels({"expression": img.multiply(10000).round().unmask(-32768).toInt16(), "fileFormat": "NUMPY_NDARRAY", "grid": grid})
    bands.append(arr["ndvi"].astype("<i2"))
    print(d, f"{(bands[-1] != -32768).mean():.2f}", end=" | ")
cube = np.stack(bands)
dirp = ROOT / "ch14-ndvi"
dirp.mkdir(exist_ok=True)
(dirp / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
(dirp / "meta.json").write_text(json.dumps({
    "width": n, "height": n, "bands": dates, "dtype": "int16", "layout": "BSQ", "scale": 0.0001, "nodata": -32768,
    "origin_xy": [X0, Y1], "crs": "EPSG:32648", "resolution_m": RES, "date": "2024",
    "provenance": {"collection": "COPERNICUS/S2_SR_HARMONIZED 2024, NDVI = (B8 - B4)/(B8 + B4)",
                   "mask": f"Cloud Score+ cs_cdf >= {CLEAR} at 10 m, then mean of clear pixels to 40 m",
                   "script": "scripts/data/export_ch14_gee.py"},
}, ensure_ascii=False, indent=1), "utf-8")
print("\nndvi stack", cube.shape, (dirp / "bands.u16z").stat().st_size // 1024, "KB")
