"""ESA WorldCover v200 (2021) on the hanoi-s2 grid, as the reference map for Chapter 9.

Usage:
    python -I scripts/data/export_ch09_worldcover.py

Output: public/data/ch09-worldcover/{bands.u16z, meta.json}; one uint16 band 'class' with the WorldCover
codes (10 tree, 20 shrub, 30 grass, 40 crop, 50 built-up, 60 bare, 80 water, 90 wetland ...), nearest neighbour.
"""
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import ee
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
PROJECT = "claudev1-503808"
ROOT = Path(__file__).resolve().parents[2]
S2 = json.loads((ROOT / "public/data/hanoi-s2/meta.json").read_text("utf-8"))

if __name__ == "__main__":
    ee.Initialize(project=PROJECT)
    x0, y1 = S2["origin_xy"]
    n, res, crs = S2["width"], S2["resolution_m"], S2["crs"]
    img = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").rename("class").toUint16()
    arr = ee.data.computePixels({
        "expression": img, "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": n, "height": n}, "crsCode": crs,
                 "affineTransform": {"scaleX": res, "shearX": 0, "translateX": x0, "shearY": 0, "scaleY": -res, "translateY": y1}},
    })
    cube = arr["class"].astype("<u2")
    out = ROOT / "public/data/ch09-worldcover"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    codes, counts = np.unique(cube, return_counts=True)
    meta = {
        "width": n, "height": n, "resolution_m": res, "crs": crs, "origin_xy": [x0, y1],
        "bands": ["class"], "dtype": "uint16", "layout": "BSQ", "scale": 1, "date": "2021",
        "class_counts": {int(c): int(k) for c, k in zip(codes, counts)},
        "provenance": {
            "collection": "ESA/WorldCover/v200 (2021), band Map",
            "resampling": "nearest neighbour from the 10 m WorldCover grid (EPSG:4326) to the hanoi-s2 UTM 48N grid",
            "script": "scripts/data/export_ch09_worldcover.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    print({int(c): round(k / cube.size * 100, 2) for c, k in zip(codes, counts)})
