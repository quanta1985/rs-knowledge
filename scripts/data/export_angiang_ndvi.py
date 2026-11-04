"""NDVI time series of a rice area in An Giang (Mekong Delta) from Sentinel-2 L2A.

Usage:
    python -I scripts/data/export_angiang_ndvi.py

Picks, among a few candidate 2x2 km boxes, the one with the highest ESA WorldCover
cropland share, then for every S2 acquisition in 2023-2024 computes the median,
25th and 75th percentile NDVI over cropland pixels that Cloud Score+ marks clear.
Acquisitions with < MIN_CLEAR of cropland pixels clear are dropped (kept count reported).

Output: public/data/angiang-ndvi.json
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import ee

PROJECT = "claudev1-503808"
CANDIDATES = {  # lon, lat - rice plains of Thoai Son / Chau Thanh / Tri Ton (An Giang)
    "thoai-son": (105.27, 10.30),
    "chau-thanh": (105.33, 10.42),
    "tri-ton": (105.08, 10.45),
    "thoai-son-n": (105.22, 10.36),
}
HALF_M = 1000
START, END = "2023-01-01", "2025-01-01"
CS_THRESHOLD = 0.6
MIN_CLEAR = 0.6
OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "angiang-ndvi.json"


def box(lonlat: tuple[float, float]) -> ee.Geometry:
    return ee.Geometry.Point(lonlat).buffer(HALF_M).bounds()


def main() -> None:
    ee.Initialize(project=PROJECT)
    crop = ee.ImageCollection("ESA/WorldCover/v200").first().eq(40)

    shares = {
        k: crop.reduceRegion(ee.Reducer.mean(), box(v), 10).get("Map").getInfo()
        for k, v in CANDIDATES.items()
    }
    print("cropland share:", {k: round(v, 3) for k, v in shares.items()})
    best = max(shares, key=shares.get)
    region = box(CANDIDATES[best])

    cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
    col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(START, END)
        .linkCollection(cs, ["cs_cdf"])
    )

    def stats(img: ee.Image) -> ee.Feature:
        clear = img.select("cs_cdf").gte(CS_THRESHOLD)
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("ndvi")
        valid = crop.And(clear)
        frac = valid.reduceRegion(ee.Reducer.sum(), region, 10).getNumber("Map").divide(
            crop.reduceRegion(ee.Reducer.sum(), region, 10).getNumber("Map"))
        pct = ndvi.updateMask(valid).reduceRegion(
            ee.Reducer.percentile([25, 50, 75]), region, 10, maxPixels=1e8)
        return ee.Feature(None, pct.combine({
            "date": img.date().format("YYYY-MM-dd"), "clear": frac,
            "sat": img.get("SPACECRAFT_NAME")}))

    rows = ee.FeatureCollection(col.map(stats)).getInfo()["features"]
    total = len(rows)
    series = {}
    for f in rows:
        p = f["properties"]
        if p.get("clear", 0) < MIN_CLEAR or p.get("ndvi_p50") is None:
            continue
        # same-day duplicates (tile overlap): keep the clearer one
        if p["date"] not in series or p["clear"] > series[p["date"]]["clear"]:
            series[p["date"]] = {
                "date": p["date"], "p25": round(p["ndvi_p25"], 3), "p50": round(p["ndvi_p50"], 3),
                "p75": round(p["ndvi_p75"], 3), "clear": round(p["clear"], 2), "sat": p["sat"]}

    pts = sorted(series.values(), key=lambda r: r["date"])
    lon, lat = CANDIDATES[best]
    OUT.write_text(json.dumps({
        "name": {"vi": "Ruộng lúa An Giang", "en": "Rice fields, An Giang"},
        "site": best, "center_lonlat": [lon, lat], "box_m": 2 * HALF_M,
        "cropland_share": round(shares[best], 3),
        "acquisitions_total": total, "acquisitions_kept": len(pts),
        "series": pts,
        "provenance": {
            "collection": "COPERNICUS/S2_SR_HARMONIZED, NDVI = (B8 - B4) / (B8 + B4)",
            "mask": f"ESA WorldCover v200 class 40 (cropland) AND Cloud Score+ cs_cdf >= {CS_THRESHOLD}",
            "filter": f"acquisition kept if >= {MIN_CLEAR:.0%} of cropland pixels clear",
            "statistic": "per-acquisition 25th/50th/75th percentile over valid pixels",
            "script": "scripts/data/export_angiang_ndvi.py",
            "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attribution": "Contains modified Copernicus Sentinel data 2023-2024; ESA WorldCover 2021 (CC BY 4.0)",
        },
    }, ensure_ascii=False, indent=1), "utf-8")
    print(f"site={best} kept {len(pts)}/{total} acquisitions -> {OUT}")


if __name__ == "__main__":
    main()
