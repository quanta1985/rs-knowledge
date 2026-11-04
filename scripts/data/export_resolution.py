"""Landsat 8/9 (30 m) and MODIS (250 m, 500 m) subsets on the same footprint as the Hanoi Sentinel-2 cube.

Usage:
    python -I scripts/data/export_resolution.py

Each product goes to public/data/res-<name>/ as bands.u16z (gzip, uint16 reflectance x 10000, BSQ,
common band names) + meta.json. Grids share the S2 cube's upper-left corner (UTM 48N) so the browser
can overlay them by nearest neighbour.
"""
import gzip
import json
from datetime import date, datetime, timezone
from pathlib import Path

import ee
import numpy as np

PROJECT = "claudev1-503808"
CRS = "EPSG:32648"
ROOT = Path(__file__).resolve().parents[2]
S2META = json.loads((ROOT / "public/data/hanoi-s2/meta.json").read_text("utf-8"))
X0, Y1 = S2META["origin_xy"]
EXTENT_M = S2META["width"] * S2META["resolution_m"]  # 5120 m
TARGET = date.fromisoformat(S2META["date"])          # 2024-02-12

PRODUCTS = {
    # name: (resolution m, common band -> source band)
    "landsat": (30, {"blue": "SR_B2", "green": "SR_B3", "red": "SR_B4", "nir": "SR_B5", "swir1": "SR_B6", "swir2": "SR_B7"}),
    "modis250": (250, {"red": "sur_refl_b01", "nir": "sur_refl_b02"}),
    "modis500": (500, {"blue": "sur_refl_b03", "green": "sur_refl_b04", "red": "sur_refl_b01", "nir": "sur_refl_b02",
                       "swir1": "sur_refl_b06", "swir2": "sur_refl_b07"}),
}


def region(res: int) -> tuple[ee.Geometry, int]:
    n = -(-EXTENT_M // res)  # ceil so the grid covers the S2 frame
    return ee.Geometry.Rectangle([X0, Y1 - n * res, X0 + n * res, Y1], ee.Projection(CRS), False), n


def clear_frac(mask: ee.Image, geom: ee.Geometry, scale: int) -> ee.Number:
    return mask.rename("m").reduceRegion(ee.Reducer.mean(), geom, scale, CRS).getNumber("m")


def pick_landsat(geom: ee.Geometry) -> ee.Image:
    def score(img):
        qa = img.select("QA_PIXEL")
        clear = qa.bitwiseAnd(0b11111).eq(0)  # fill, dilated cloud, cirrus, cloud, shadow all off
        days = ee.Number(img.date().difference(ee.Date(str(TARGET)), "day")).abs()
        return img.set({"clear": clear_frac(clear, geom, 30), "days": days})

    col = (ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").merge(ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"))
           # Hanoi winter is cloudy: search +/- 4 months (Jan-Apr 2024 had no clear Landsat scene)
           .filterBounds(geom).filterDate(ee.Date(str(TARGET)).advance(-4, "month"), ee.Date(str(TARGET)).advance(4, "month"))
           .map(score).filter(ee.Filter.gte("clear", 0.99)).sort("days"))
    return ee.Image(col.first())


def pick_modis(coll: str, geom: ee.Geometry) -> ee.Image:
    """Closest Terra day with >= 95 % clear (state_1km) and near-nadir view (sensor zenith <= 30 deg)."""
    ga = ee.ImageCollection("MODIS/061/MOD09GA")

    def score(img):
        s = ee.Image(ga.filterDate(img.date(), img.date().advance(1, "day")).first())
        q = s.select("state_1km")
        clear = q.bitwiseAnd(0b11).eq(0).And(q.rightShift(2).bitwiseAnd(1).eq(0))  # cloud state clear, no shadow
        vz = s.select("SensorZenith").multiply(0.01).rename("m")
        days = ee.Number(img.date().difference(ee.Date(str(TARGET)), "day")).abs()
        return img.set({"clear": clear_frac(clear, geom, 1000), "view_zenith": clear_frac(vz, geom, 1000), "days": days})

    col = (ee.ImageCollection(coll).filterBounds(geom)
           .filterDate(ee.Date(str(TARGET)).advance(-3, "month"), ee.Date(str(TARGET)).advance(3, "month"))
           .map(score).filter(ee.Filter.gte("clear", 0.95)).filter(ee.Filter.lte("view_zenith", 30)).sort("days"))
    return ee.Image(col.first())


def to_reflectance(name: str, img: ee.Image, bands: dict[str, str]) -> ee.Image:
    src = img.select(list(bands.values()), list(bands.keys()))
    if name == "landsat":  # Collection 2 L2 scale/offset
        src = src.multiply(0.0000275).add(-0.2)
    else:                  # MOD09 scale
        src = src.multiply(0.0001)
    return src.max(0).multiply(10000).round().toUint16()


def export(name: str) -> None:
    res, bands = PRODUCTS[name]
    geom, n = region(res)
    img = (pick_landsat(geom) if name == "landsat"
           else pick_modis("MODIS/061/MOD09GQ" if name == "modis250" else "MODIS/061/MOD09GA", geom))
    info = img.toDictionary(["system:index", "clear", "view_zenith", "SPACECRAFT_ID", "WRS_PATH", "WRS_ROW"]).getInfo()
    day = ee.Date(img.get("system:time_start")).format("YYYY-MM-dd").getInfo()
    arr = ee.data.computePixels({
        "expression": to_reflectance(name, img, bands),
        "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": n, "height": n},
                 "affineTransform": {"scaleX": res, "shearX": 0, "translateX": X0, "shearY": 0, "scaleY": -res, "translateY": Y1},
                 "crsCode": CRS},
    })
    cube = np.stack([arr[b] for b in bands]).astype("<u2")
    out = ROOT / "public" / "data" / f"res-{name}"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    collection = {"landsat": "LANDSAT/LC0[89]/C02/T1_L2 (Collection 2 Level-2 surface reflectance)",
                  "modis250": "MODIS/061/MOD09GQ (Terra daily surface reflectance, 250 m)",
                  "modis500": "MODIS/061/MOD09GA (Terra daily surface reflectance, 500 m)"}[name]
    meta = {
        "width": n, "height": n, "resolution_m": res, "crs": CRS, "origin_xy": [X0, Y1],
        "bands": list(bands), "source_bands": bands, "dtype": "uint16", "layout": "BSQ", "scale": 1e-4,
        "date": day, "scene": info,
        "provenance": {
            "collection": collection,
            "selection": ("Landsat: closest date to the S2 scene with >= 99 % clear pixels (QA_PIXEL)" if name == "landsat"
                          else "MODIS Terra: closest date with >= 95 % clear (state_1km) and sensor zenith <= 30 deg"),
            "resampling": "nearest neighbour to a UTM 48N grid sharing the S2 cube's upper-left corner"
                          + ("" if name == "landsat" else " (MODIS native grid is sinusoidal)"),
            "script": "scripts/data/export_resolution.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    print(f"{name}: {day} {n}x{n} px @ {res} m, clear={info.get('clear')}, mean={cube.mean(axis=(1, 2)).round(0).tolist()}")


if __name__ == "__main__":
    import sys
    ee.Initialize(project=PROJECT)
    for p in sys.argv[1:] or PRODUCTS:
        export(p)
