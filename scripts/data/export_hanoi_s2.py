"""Export a Sentinel-2 L2A subset (Ho Tay - Red River, Hanoi) for the in-browser figures.

Usage:
    python -I scripts/data/export_hanoi_s2.py --list            # rank clear dry-season scenes
    python -I scripts/data/export_hanoi_s2.py --date 2024-12-20 # export that date

Output (public/data/hanoi-s2/):
    bands.u16z     gzip of uint16 surface reflectance x 10000, band-sequential (BSQ)
    meta.json      grid, bands, scene id, provenance
"""
import argparse
import gzip
import json
import sys
from datetime import date, timezone, datetime
from pathlib import Path

import ee
import numpy as np

PROJECT = "claudev1-503808"
CENTER_LONLAT = (105.833, 21.055)  # between Ho Tay and the Red River
SIZE_PX = 512
RES_M = 10
CRS = "EPSG:32648"  # WGS 84 / UTM 48N, native S2 grid for tile 48QWJ
BANDS = ["B2", "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B11", "B12"]
CS_THRESHOLD = 0.6  # Cloud Score+ cs_cdf; >= threshold counted as clear
OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "hanoi-s2"


def grid():
    """10 m grid snapped to multiples of 20 m so 20 m bands stay pixel-aligned."""
    pt = ee.Geometry.Point(CENTER_LONLAT).transform(CRS, 1).coordinates().getInfo()
    half = SIZE_PX * RES_M / 2
    x0 = round((pt[0] - half) / 20) * 20
    y1 = round((pt[1] + half) / 20) * 20
    region = ee.Geometry.Rectangle(
        [x0, y1 - SIZE_PX * RES_M, x0 + SIZE_PX * RES_M, y1], ee.Projection(CRS), False
    )
    return x0, y1, region


def collection(region):
    cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate("2022-10-01", "2025-04-01")
        .filter(ee.Filter.calendarRange(10, 3, "month"))
        .linkCollection(cs, ["cs_cdf"])
    )

    def score(img):
        clear = img.select("cs_cdf").gte(CS_THRESHOLD)
        frac = clear.reduceRegion(ee.Reducer.mean(), region, 20, CRS).get("cs_cdf")
        return img.set("clear_frac", frac)

    return s2.map(score)


def list_scenes(region):
    col = collection(region).sort("clear_frac", False).limit(10)
    info = col.reduceColumns(
        ee.Reducer.toList(3), ["system:index", "clear_frac", "CLOUDY_PIXEL_PERCENTAGE"]
    ).get("list").getInfo()
    for idx, frac, cloudy in info:
        print(f"{idx[:8]}  clear={frac:.4f}  tile_cloudy%={cloudy:.1f}  id={idx}")


def export(region, x0, y1, day):
    start = ee.Date(day)
    col = collection(region).filterDate(start, start.advance(1, "day"))
    img = ee.Image(col.sort("clear_frac", False).first())
    props = img.toDictionary(["system:index", "clear_frac", "SPACECRAFT_NAME", "MGRS_TILE",
                              "SENSING_ORBIT_NUMBER", "PROCESSING_BASELINE"]).getInfo()
    if not props:
        sys.exit(f"No scene on {day}")
    arr = ee.data.computePixels({
        "expression": img.select(BANDS).toUint16(),
        "fileFormat": "NUMPY_NDARRAY",
        "grid": {
            "dimensions": {"width": SIZE_PX, "height": SIZE_PX},
            "affineTransform": {"scaleX": RES_M, "shearX": 0, "translateX": x0,
                                "shearY": 0, "scaleY": -RES_M, "translateY": y1},
            "crsCode": CRS,
        },
    })
    cube = np.stack([arr[b] for b in BANDS]).astype("<u2")  # (band, row, col)
    assert cube.shape == (len(BANDS), SIZE_PX, SIZE_PX), cube.shape

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    bounds_ll = region.transform("EPSG:4326", 1).bounds(1).coordinates().getInfo()[0]
    lons = [p[0] for p in bounds_ll]
    lats = [p[1] for p in bounds_ll]
    meta = {
        "name": {"vi": "Hồ Tây – sông Hồng, Hà Nội", "en": "West Lake – Red River, Hanoi"},
        "width": SIZE_PX, "height": SIZE_PX, "resolution_m": RES_M, "crs": CRS,
        "origin_xy": [x0, y1],
        "bbox_lonlat": [min(lons), min(lats), max(lons), max(lats)],
        "bands": BANDS, "dtype": "uint16", "layout": "BSQ", "scale": 1e-4,
        "scene": props, "date": day,
        "provenance": {
            "collection": "COPERNICUS/S2_SR_HARMONIZED (Level-2A surface reflectance)",
            "cloud_mask": f"none applied; scene chosen by Cloud Score+ cs_cdf >= {CS_THRESHOLD}",
            "resampling": "20 m bands (B5,B6,B7,B8A,B11,B12) nearest-neighbour to 10 m",
            "script": "scripts/data/export_hanoi_s2.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attribution": f"Contains modified Copernicus Sentinel data {day[:4]}",
        },
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), "utf-8")
    np.save(OUT.parent.parent.parent / "scripts" / "data" / "hanoi_cube.npy", cube)
    print("saved", OUT, props)


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--list", action="store_true")
    g.add_argument("--date", type=date.fromisoformat)
    args = ap.parse_args()
    ee.Initialize(project=PROJECT)
    x0, y1, region = grid()
    if args.list:
        list_scenes(region)
    else:
        export(region, x0, y1, args.date.isoformat())


if __name__ == "__main__":
    main()
