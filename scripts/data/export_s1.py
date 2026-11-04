"""Sentinel-1 data for Chapter 11.

Usage:
    python -I scripts/data/export_s1.py hanoi     # VV/VH on the Hanoi S2 frame: 2024-02-12 (same day as S2), pre/post Typhoon Yagi
    python -I scripts/data/export_s1.py angiang   # VH/VV time series over the Tri Ton rice box (one relative orbit)

COPERNICUS/S1_GRD in Earth Engine is already calibrated to sigma0, thermal-noise removed and terrain corrected
(SRTM 30 m), in dB. No speckle filter is applied here (the chapter filters in the browser).
Outputs: public/data/s1-hanoi/{bands.u16z, meta.json} (int16 dB x 100) and public/data/angiang-s1.json.
"""
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import ee
import numpy as np

PROJECT = "claudev1-503808"
CRS = "EPSG:32648"
ROOT = Path(__file__).resolve().parents[2]
S2META = json.loads((ROOT / "public/data/hanoi-s2/meta.json").read_text("utf-8"))
NDVI = json.loads((ROOT / "public/data/angiang-ndvi.json").read_text("utf-8"))

# date -> (relative orbit, pass) chosen from the acquisition list over the frame
SCENES = {
    "ref": ("2024-02-12", 128),   # same day as the Sentinel-2 scene of Chapter 6
    "pre": ("2024-08-31", 91),    # before Typhoon Yagi (landfall 7 Sep 2024)
    "post": ("2024-09-12", 91),   # after, same relative orbit as "pre"
}


def s1(day: str, orbit: int, geom: ee.Geometry) -> ee.Image:
    d = ee.Date(day)
    return ee.Image(ee.ImageCollection("COPERNICUS/S1_GRD").filterBounds(geom).filterDate(d, d.advance(1, "day"))
                    .filter(ee.Filter.eq("relativeOrbitNumber_start", orbit))
                    .filter(ee.Filter.eq("instrumentMode", "IW")).mosaic())


def hanoi() -> None:
    x0, y1 = S2META["origin_xy"]
    n, res = S2META["width"], S2META["resolution_m"]
    geom = ee.Geometry.Rectangle([x0, y1 - n * res, x0 + n * res, y1], ee.Projection(CRS), False)
    names, imgs = [], []
    for key, (day, orbit) in SCENES.items():
        for pol in ("VV", "VH"):
            names.append(f"{pol.lower()}_{key}")
            imgs.append(s1(day, orbit, geom).select(pol).rename(names[-1]))
    stack = ee.Image.cat(imgs).multiply(100).round().toInt16()
    arr = ee.data.computePixels({
        "expression": stack, "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": n, "height": n},
                 "affineTransform": {"scaleX": res, "shearX": 0, "translateX": x0, "shearY": 0, "scaleY": -res, "translateY": y1},
                 "crsCode": CRS},
    })
    cube = np.stack([arr[b] for b in names]).astype("<i2")
    out = ROOT / "public/data/s1-hanoi"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    meta = {
        "width": n, "height": n, "resolution_m": res, "crs": CRS, "origin_xy": [x0, y1],
        "bands": names, "dtype": "int16", "layout": "BSQ", "scale": 0.01, "unit": "dB (sigma0)",
        "scenes": {k: {"date": d, "relative_orbit": o, "pass": "ASCENDING" if o == 128 else "DESCENDING"} for k, (d, o) in SCENES.items()},
        "date": SCENES["ref"][0],
        "provenance": {
            "collection": "COPERNICUS/S1_GRD (Sentinel-1A, IW, GRD, sigma0 dB, terrain-corrected by GEE)",
            "speckle": "none",
            "resampling": "nearest neighbour to the Sentinel-2 cube's 10 m UTM 48N grid",
            "script": "scripts/data/export_s1.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attribution": "Contains modified Copernicus Sentinel data 2024",
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    stats = {b: (np.percentile(cube[i], [5, 50, 95]) / 100).round(1).tolist() for i, b in enumerate(names)}
    print("s1-hanoi", stats)


def angiang() -> None:
    lon, lat = NDVI["center_lonlat"]
    box = ee.Geometry.Point([lon, lat]).buffer(NDVI["box_m"] / 2).bounds()
    crop = ee.ImageCollection("ESA/WorldCover/v200").first().eq(40)
    col = (ee.ImageCollection("COPERNICUS/S1_GRD").filterBounds(box).filterDate("2023-01-01", "2025-01-01")
           .filter(ee.Filter.eq("instrumentMode", "IW")).filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH")))
    orbits = col.aggregate_histogram("relativeOrbitNumber_start").getInfo()
    orbit = int(float(max(orbits, key=orbits.get)))
    col = col.filter(ee.Filter.eq("relativeOrbitNumber_start", orbit))

    def f(img):
        lin = ee.Image(10).pow(img.select(["VV", "VH"]).divide(10))  # average in linear power, not dB
        m = lin.updateMask(crop).reduceRegion(ee.Reducer.mean(), box, 10, maxPixels=1e8)
        return ee.Feature(None, {"date": img.date().format("YYYY-MM-dd"), "vv": m.get("VV"), "vh": m.get("VH")})

    rows = [r["properties"] for r in ee.FeatureCollection(col.map(f)).getInfo()["features"] if r["properties"].get("vh")]
    rows = sorted({r["date"]: r for r in rows}.values(), key=lambda r: r["date"])
    series = [{"date": r["date"], "vv_db": round(10 * np.log10(r["vv"]), 2), "vh_db": round(10 * np.log10(r["vh"]), 2)} for r in rows]
    (ROOT / "public/data/angiang-s1.json").write_text(json.dumps({
        "site": NDVI["site"], "center_lonlat": [lon, lat], "box_m": NDVI["box_m"],
        "relative_orbit": orbit, "orbits_available": orbits, "series": series,
        "provenance": {
            "collection": "COPERNICUS/S1_GRD IW (sigma0), single relative orbit to keep the viewing geometry fixed",
            "mask": "ESA WorldCover v200 class 40 (cropland), same box as angiang-ndvi.json",
            "statistic": "mean of linear sigma0 over cropland pixels, converted to dB",
            "script": "scripts/data/export_s1.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attribution": "Contains modified Copernicus Sentinel data 2023-2024",
        },
    }, ensure_ascii=False, indent=1), "utf-8")
    print(f"angiang orbit {orbit} ({orbits}): {len(series)} dates")


if __name__ == "__main__":
    ee.Initialize(project=PROJECT)
    for task in sys.argv[1:] or ["hanoi", "angiang"]:
        {"hanoi": hanoi, "angiang": angiang}[task]()
