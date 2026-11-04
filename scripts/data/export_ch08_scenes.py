"""Chapter 8 scenes: small cloud-free Sentinel-2 L2A cubes of contrasting Vietnamese landscapes.

Usage:
    python -I scripts/data/export_ch08_scenes.py --list [scene ...]       # best dates per scene
    python -I scripts/data/export_ch08_scenes.py [scene ...]              # export (best date, or SCENE[date])

Each scene -> public/data/ch08-<id>/{bands.u16z, meta.json}: 512 x 512 px @ 10 m in the scene's UTM zone,
bands B2 B3 B4 B8 B11 B12 (20 m bands nearest-neighbour to 10 m), reflectance x 10000 (loadProduct format).
"""
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import ee
import numpy as np

PROJECT = "claudev1-503808"
ROOT = Path(__file__).resolve().parents[2]
N, RES = 512, 10
BANDS = ["B2", "B3", "B4", "B8", "B11", "B12"]
CS_CLEAR = 0.6
SCENES = {
    "camau": {"lonlat": (104.97, 8.68), "months": (1, 4), "name": {"vi": "Rừng ngập mặn và đầm tôm, Cà Mau", "en": "Mangroves and shrimp ponds, Ca Mau"}},
    "angiang": {"lonlat": (105.005, 10.49), "months": (1, 4), "name": {"vi": "Núi Cấm và ruộng lúa, An Giang", "en": "Cam Mountain and rice fields, An Giang"}},
    "dalat": {"lonlat": (108.44, 11.94), "months": (12, 3), "name": {"vi": "Đà Lạt: đô thị, nhà kính, rừng thông", "en": "Da Lat: town, greenhouses, pine forest"}},
    "danang": {"lonlat": (108.215, 16.055), "months": (3, 8), "name": {"vi": "Đà Nẵng: sân bay, sông Hàn, bờ biển", "en": "Da Nang: airport, Han River, coast"}},
}
DATES: dict[str, str] = {}  # filled from argv "scene=YYYY-MM-DD"


def frame(lon: float, lat: float):
    zone = int((lon + 180) // 6) + 1
    crs = f"EPSG:326{zone:02d}"
    x, y = ee.Geometry.Point([lon, lat]).transform(crs, 1).coordinates().getInfo()
    half = N * RES / 2
    x0, y1 = round((x - half) / 20) * 20, round((y + half) / 20) * 20  # 20 m aligned like hanoi-s2
    region = ee.Geometry.Rectangle([x0, y1 - N * RES, x0 + N * RES, y1], ee.Projection(crs), False)
    return crs, x0, y1, region


def ranked(sid: str):
    s = SCENES[sid]
    crs, x0, y1, region = frame(*s["lonlat"])
    cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
    col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(region).filterDate("2023-01-01", "2025-07-01")
           .filter(ee.Filter.calendarRange(*s["months"], "month")).linkCollection(cs, ["cs_cdf"]))
    col = col.map(lambda i: i.set("clear_frac", i.select("cs_cdf").gte(CS_CLEAR).reduceRegion(ee.Reducer.mean(), region, 20, crs).get("cs_cdf")))
    # the frame must be fully covered by the tile (no nodata edge)
    col = col.map(lambda i: i.set("cover", i.select("B4").mask().reduceRegion(ee.Reducer.mean(), region, 40, crs).get("B4")))
    return col.filter(ee.Filter.gte("cover", 0.999)).sort("clear_frac", False), crs, x0, y1


def list_dates(sid: str) -> None:
    col, *_ = ranked(sid)
    rows = col.limit(6).reduceColumns(ee.Reducer.toList(2), ["system:index", "clear_frac"]).get("list").getInfo()
    for idx, f in rows:
        print(sid, idx[:8], f"clear={f:.4f}", idx)


def export(sid: str) -> None:
    col, crs, x0, y1 = ranked(sid)
    if sid in DATES:
        d = ee.Date(DATES[sid])
        col = col.filterDate(d, d.advance(1, "day"))
    img = ee.Image(col.first())
    props = img.toDictionary(["system:index", "clear_frac", "SPACECRAFT_NAME", "MGRS_TILE"]).getInfo()
    arr = ee.data.computePixels({
        "expression": img.select(BANDS).toUint16(), "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": N, "height": N}, "crsCode": crs,
                 "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": x0, "shearY": 0, "scaleY": -RES, "translateY": y1}},
    })
    cube = np.stack([arr[b] for b in BANDS]).astype("<u2")
    out = ROOT / "public/data" / f"ch08-{sid}"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    day = f"{props['system:index'][:4]}-{props['system:index'][4:6]}-{props['system:index'][6:8]}"
    meta = {"name": SCENES[sid]["name"], "width": N, "height": N, "resolution_m": RES, "crs": crs, "origin_xy": [x0, y1],
            "bands": BANDS, "dtype": "uint16", "layout": "BSQ", "scale": 1e-4, "date": day, "scene": props,
            "provenance": {"collection": "COPERNICUS/S2_SR_HARMONIZED (Level-2A), date chosen by Cloud Score+ cs_cdf >= 0.6",
                           "resampling": "20 m bands (B11, B12) nearest-neighbour to 10 m",
                           "script": "scripts/data/export_ch08_scenes.py",
                           "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                           "attribution": f"Contains modified Copernicus Sentinel data {day[:4]}"}}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    print(sid, day, props["clear_frac"], (out / "bands.u16z").stat().st_size // 1024, "KiB")


if __name__ == "__main__":
    ee.Initialize(project=PROJECT)
    args = sys.argv[1:]
    listing = "--list" in args
    names = []
    for a in args:
        if a == "--list":
            continue
        sid, _, day = a.partition("=")
        names.append(sid)
        if day:
            DATES[sid] = day
    for sid in names or list(SCENES):
        list_dates(sid) if listing else export(sid)
