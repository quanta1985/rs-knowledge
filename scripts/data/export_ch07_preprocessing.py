"""Chapter 7 data on the Hanoi frame (same 512 x 512 @ 10 m UTM 48N grid as public/data/hanoi-s2).

Usage:
    python -I scripts/data/export_ch07_preprocessing.py toa             # L1C top-of-atmosphere, same scene as hanoi-s2
    python -I scripts/data/export_ch07_preprocessing.py clouds --list   # rank partly cloudy dates
    python -I scripts/data/export_ch07_preprocessing.py clouds --date YYYY-MM-DD
    python -I scripts/data/export_ch07_preprocessing.py composite --date YYYY-MM-DD   # +-45 days around the cloudy date

Outputs public/data/ch07-toa/, ch07-clouds/, ch07-composite/ : gzip'd BSQ bands.u16z + meta.json (loadProduct format).
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
HANOI = json.loads((ROOT / "public/data/hanoi-s2/meta.json").read_text("utf-8"))
X0, Y1 = HANOI["origin_xy"]
N, RES = HANOI["width"], HANOI["resolution_m"]
REGION = None  # set after ee.Initialize
SCENE = HANOI["scene"]["system:index"]  # 20240212T032849_20240212T033821_T48QWJ
BANDS = HANOI["bands"]
CS_CLEAR = 0.6


def pixels(img: ee.Image, names: list[str]) -> np.ndarray:
    arr = ee.data.computePixels({
        "expression": img.select(names), "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": N, "height": N}, "crsCode": CRS,
                 "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": X0, "shearY": 0, "scaleY": -RES, "translateY": Y1}},
    })
    return np.stack([arr[b] for b in names]).astype("<u2")


def write(name: str, cube: np.ndarray, bands: list[str], extra: dict) -> None:
    out = ROOT / "public/data" / name
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    meta = {"width": N, "height": N, "resolution_m": RES, "crs": CRS, "origin_xy": [X0, Y1],
            "bands": bands, "dtype": "uint16", "layout": "BSQ", "scale": 1e-4, **extra}
    meta["provenance"] = {**meta.get("provenance", {}), "script": "scripts/data/export_ch07_preprocessing.py",
                          "exported": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    print(name, cube.shape, (out / "bands.u16z").stat().st_size // 1024, "KiB")


def toa() -> None:
    img = ee.Image(f"COPERNICUS/S2_HARMONIZED/{SCENE}")
    keys = ["MEAN_SOLAR_ZENITH_ANGLE", "MEAN_SOLAR_AZIMUTH_ANGLE", "REFLECTANCE_CONVERSION_CORRECTION", "PROCESSING_BASELINE",
            "SPACECRAFT_NAME", "system:index"] + [f"SOLAR_IRRADIANCE_{b}" for b in BANDS] + [f"RADIO_ADD_OFFSET_{b}" for b in BANDS]
    props = img.toDictionary(keys).getInfo()
    props["SENSING_TIME"] = img.date().format().getInfo()
    write("ch07-toa", pixels(img, BANDS), BANDS, {
        "date": HANOI["date"], "scene": props,
        "provenance": {"collection": "COPERNICUS/S2_HARMONIZED (Level-1C top-of-atmosphere reflectance x 10000; "
                                     "the harmonized collection already removed the +1000 DN offset of baseline >= 04.00)",
                       "attribution": "Contains modified Copernicus Sentinel data 2024"},
    })


def l2a_with_cs(start: str, end: str) -> ee.ImageCollection:
    cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
    return (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(REGION).filterDate(start, end)
            .linkCollection(cs, ["cs", "cs_cdf"]))


def clear_frac(img: ee.Image) -> ee.Image:
    f = img.select("cs_cdf").gte(CS_CLEAR).reduceRegion(ee.Reducer.mean(), REGION, 20, CRS).get("cs_cdf")
    return img.set("clear_frac", f)


def clouds_list() -> None:
    col = l2a_with_cs("2023-01-01", "2025-01-01").map(clear_frac)
    col = col.filter(ee.Filter.rangeContains("clear_frac", 0.35, 0.75))
    rows = col.reduceColumns(ee.Reducer.toList(3), ["system:index", "clear_frac", "CLOUDY_PIXEL_PERCENTAGE"]).get("list").getInfo()
    for idx, f, c in sorted(rows):
        print(idx[:8], f"clear={f:.3f} tile_cloudy={c:.1f}", idx)


def clouds(day: str) -> None:
    d = ee.Date(day)
    img = ee.Image(l2a_with_cs(d, d.advance(1, "day")).map(clear_frac).sort("clear_frac", False).first())
    props = img.toDictionary(["system:index", "clear_frac", "CLOUDY_PIXEL_PERCENTAGE", "SPACECRAFT_NAME"]).getInfo()
    names = ["B2", "B3", "B4", "B8", "B11"]
    stack = img.select(names).addBands(img.select(["cs", "cs_cdf"]).multiply(10000)).addBands(img.select("SCL")).toUint16()
    write("ch07-clouds", pixels(stack, names + ["cs", "cs_cdf", "SCL"]), names + ["cs", "cs_cdf", "SCL"], {
        "date": day, "scene": props,
        "notes": "cs and cs_cdf are Cloud Score+ x 10000 (1 = clear); SCL is the Sen2Cor scene classification (no scale)",
        "provenance": {"collection": "COPERNICUS/S2_SR_HARMONIZED + GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
                       "attribution": f"Contains modified Copernicus Sentinel data {day[:4]}"},
    })


def composite(day: str) -> None:
    d = ee.Date(day)
    col = l2a_with_cs(d.advance(-45, "day"), d.advance(46, "day"))
    names = ["B2", "B3", "B4"]  # true colour only (keeps the file < 3 MB)
    raw = col.select(names).median()
    masked_col = col.map(lambda i: i.select(names).updateMask(i.select("cs_cdf").gte(CS_CLEAR)))
    masked = masked_col.median()
    count = masked_col.select("B4").count().rename("n_clear")
    total = col.select("B4").count().rename("n_all")
    stack = (raw.rename([f"{b}_raw" for b in names]).addBands(masked.rename([f"{b}_cs" for b in names]))
             .unmask(0).addBands(count).addBands(total).toUint16())
    bands = [f"{b}_raw" for b in names] + [f"{b}_cs" for b in names] + ["n_clear", "n_all"]
    dates = col.aggregate_array("system:index").getInfo()
    write("ch07-composite", pixels(stack, bands), bands, {
        "date": day, "window": [d.advance(-45, "day").format("YYYY-MM-dd").getInfo(), d.advance(45, "day").format("YYYY-MM-dd").getInfo()],
        "n_images": len(dates), "images": dates,
        "notes": "*_raw: per-pixel median of all images; *_cs: median after masking cs_cdf < 0.6; n_clear / n_all: counts (no scale)",
        "provenance": {"collection": "COPERNICUS/S2_SR_HARMONIZED + Cloud Score+",
                       "attribution": f"Contains modified Copernicus Sentinel data {day[:4]}"},
    })


if __name__ == "__main__":
    ee.Initialize(project=PROJECT)
    REGION = ee.Geometry.Rectangle([X0, Y1 - N * RES, X0 + N * RES, Y1], ee.Projection(CRS), False)
    task, *rest = sys.argv[1:] or ["toa"]
    if task == "toa":
        toa()
    elif task == "clouds" and rest[:1] == ["--list"]:
        clouds_list()
    elif task == "clouds":
        clouds(rest[1])
    elif task == "composite":
        composite(rest[1])
