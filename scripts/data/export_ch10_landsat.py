"""Landsat Collection 2 Level-2 products for Chapter 10 (change detection).

Usage:
    python -I scripts/data/export_ch10_landsat.py [urban] [series] [coast]

urban  -> public/data/ch10-hanoi/   west Hanoi 15 x 15 km @ 30 m; median composites ~2000 and ~2024 (red, nir, swir1)
series -> public/data/ch10-series/  central 7.5 x 7.5 km of the same grid; annual median NDVI 2000-2024 (int16 x 10000)
coast  -> public/data/ch10-camau/   Ca Mau cape 15 x 15 km @ 30 m; median composites ~2000 and ~2024 (green, nir, swir1)

Composites: per-pixel median of all clear observations (QA_PIXEL bits 1 dilated cloud, 3 cloud, 4 shadow masked)
in a 19-month window (Oct of the year before .. Apr of the year after) to beat clouds.
Reflectance = DN x 0.0000275 - 0.2, stored as uint16 x 10000 (clamped at 0). Landsat 5/7 for ~2000, Landsat 8/9 for ~2024.
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
CRS = "EPSG:32648"
ROOT = Path(__file__).resolve().parents[2]
RES = 30
OLD = ["LANDSAT/LT05/C02/T1_L2", "LANDSAT/LE07/C02/T1_L2"]
NEW = ["LANDSAT/LC08/C02/T1_L2", "LANDSAT/LC09/C02/T1_L2"]
BANDS_OLD = {"blue": "SR_B1", "green": "SR_B2", "red": "SR_B3", "nir": "SR_B4", "swir1": "SR_B5"}
BANDS_NEW = {"blue": "SR_B2", "green": "SR_B3", "red": "SR_B4", "nir": "SR_B5", "swir1": "SR_B6"}
SITES = {
    "hanoi": {"center": (105.775, 21.005), "size": 500, "name": {"vi": "Tây Hà Nội (Mỹ Đình – Hà Đông)", "en": "West Hanoi (My Dinh – Ha Dong)"}},
    "camau": {"center": (104.76, 8.62), "size": 500, "name": {"vi": "Mũi Cà Mau", "en": "Ca Mau cape"}},
}


def grid(center, size):
    """UTM grid snapped to the Landsat pixel lattice (corners at 30 m multiples + 15 m)."""
    x, y = ee.Geometry.Point(center).transform(CRS, 1).coordinates().getInfo()
    half = size * RES / 2
    x0 = round((x - half - 15) / RES) * RES + 15
    y1 = round((y + half - 15) / RES) * RES + 15
    return x0, y1


def region(x0, y1, size):
    return ee.Geometry.Rectangle([x0, y1 - size * RES, x0 + size * RES, y1], ee.Projection(CRS), False)


def prep(names):
    def f(img):
        qa = img.select("QA_PIXEL")
        clear = qa.bitwiseAnd(1 << 1).eq(0).And(qa.bitwiseAnd(1 << 3).eq(0)).And(qa.bitwiseAnd(1 << 4).eq(0))
        sr = img.select(list(names.values()), list(names.keys())).multiply(0.0000275).add(-0.2)
        return sr.updateMask(clear)
    return f


def landsat(cols, names, geom, start, end):
    out = None
    for c in cols:
        ic = ee.ImageCollection(c).filterBounds(geom).filterDate(start, end).map(prep(names))
        out = ic if out is None else out.merge(ic)
    return out


def pixels(img, x0, y1, size):
    arr = ee.data.computePixels({
        "expression": img, "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": size, "height": size}, "crsCode": CRS,
                 "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": x0, "shearY": 0, "scaleY": -RES, "translateY": y1}},
    })
    return {b: np.asarray(arr[b], "f8") for b in arr.dtype.names}


def write(dirname, cube, names, meta):
    out = ROOT / "public/data" / dirname
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    meta = {**meta, "bands": names, "layout": "BSQ", "crs": CRS, "resolution_m": RES,
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    print(dirname, cube.shape, round((out / "bands.u16z").stat().st_size / 1e6, 2), "MB")


def pair(site, bands):
    s = SITES[site]
    x0, y1 = grid(s["center"], s["size"])
    geom = region(x0, y1, s["size"])
    periods = {"2000": ("1999-10-01", "2001-05-01", OLD, BANDS_OLD), "2024": ("2023-10-01", "2025-05-01", NEW, BANDS_NEW)}
    layers, names, counts = [], [], {}
    for year, (a, b, cols, nm) in periods.items():
        col = landsat(cols, {k: nm[k] for k in bands}, geom, a, b)
        med = col.median()
        cnt = col.select(bands[0]).count().rename("n")
        px = pixels(ee.Image.cat([med, cnt]), x0, y1, s["size"])
        counts[year] = {"scenes": col.size().getInfo(), "clear_obs_p5_p50": np.percentile(px["n"], [5, 50]).tolist()}
        for bnd in bands:
            layers.append(np.clip(np.nan_to_num(px[bnd], nan=0) * 10000, 0, 65535).round().astype("<u2"))
            names.append(f"{bnd}_{year}")
    cube = np.stack(layers)
    write(f"ch10-{site}", cube, names, {
        "name": s["name"], "width": s["size"], "height": s["size"], "origin_xy": [x0, y1], "dtype": "uint16", "scale": 0.0001,
        "date": "2000 / 2024", "periods": {k: v[:2] for k, v in periods.items()}, "clear_observations": counts,
        "provenance": {"collections": "LANDSAT/LT05, LE07 (1999-10..2001-04); LC08, LC09 (2023-10..2025-04), C02 T1_L2",
                       "composite": "per-pixel median of clear observations (QA_PIXEL bits 1, 3, 4 masked)",
                       "script": "scripts/data/export_ch10_landsat.py",
                       "attribution": "Landsat imagery courtesy of the U.S. Geological Survey"}})
    print(site, counts)


def series():
    s = SITES["hanoi"]
    X0, Y1 = grid(s["center"], s["size"])
    size, off = 250, 125
    x0, y1 = X0 + off * RES, Y1 - off * RES
    geom = region(x0, y1, size)
    years = list(range(2000, 2025))
    imgs, nobs = [], []
    for y in years:
        parts = []
        for c in ["LANDSAT/LT05/C02/T1_L2", "LANDSAT/LE07/C02/T1_L2"]:
            parts.append(ee.ImageCollection(c).filterBounds(geom).filterDate(f"{y}-01-01", f"{y + 1}-01-01").map(prep({"red": "SR_B3", "nir": "SR_B4"})))
        for c in ["LANDSAT/LC08/C02/T1_L2", "LANDSAT/LC09/C02/T1_L2"]:
            parts.append(ee.ImageCollection(c).filterBounds(geom).filterDate(f"{y}-01-01", f"{y + 1}-01-01").map(prep({"red": "SR_B4", "nir": "SR_B5"})))
        col = parts[0].merge(parts[1]).merge(parts[2]).merge(parts[3])
        ndvi = col.map(lambda i: i.normalizedDifference(["nir", "red"]).rename("ndvi"))
        imgs.append(ndvi.median().rename(f"ndvi_{y}"))
        nobs.append(ndvi.count().rename(f"n_{y}"))
    layers, counts = [], {}
    for chunk in (years[:13], years[13:]):
        ix = [years.index(y) for y in chunk]
        px = pixels(ee.Image.cat([imgs[i] for i in ix] + [nobs[i] for i in ix]), x0, y1, size)
        for y in chunk:
            v = px[f"ndvi_{y}"]
            layers.append(np.where(np.isfinite(v), np.round(v * 10000), -32768).astype("<i2"))
            counts[y] = float(np.median(px[f"n_{y}"]))
    cube = np.stack(layers)
    write("ch10-series", cube, [f"ndvi_{y}" for y in years], {
        "name": s["name"], "width": size, "height": size, "origin_xy": [x0, y1], "dtype": "int16", "scale": 0.0001, "nodata": -32768,
        "years": years, "median_clear_obs_per_year": counts, "date": "2000-2024",
        "provenance": {"collections": "LANDSAT/LT05, LE07, LC08, LC09 C02 T1_L2", "statistic": "per-pixel median NDVI of clear observations per calendar year",
                       "grid": "central 250 x 250 px of ch10-hanoi (same 30 m lattice)", "script": "scripts/data/export_ch10_landsat.py",
                       "attribution": "Landsat imagery courtesy of the U.S. Geological Survey"}})
    print("obs per year", counts)


if __name__ == "__main__":
    ee.Initialize(project=PROJECT)
    for task in sys.argv[1:] or ["urban", "series", "coast"]:
        {"urban": lambda: pair("hanoi", ["red", "nir", "swir1"]), "series": series,
         "coast": lambda: pair("camau", ["green", "nir", "swir1"])}[task]()
