"""Usable Sentinel-2 acquisitions per calendar month, Hanoi vs An Giang, 2019-2024.

Usage:
    python -I scripts/data/export_revisit.py

For each acquisition date (same-day tiles merged, keeping the clearest), the clear share of a
2 x 2 km box is computed from Cloud Score+ (cs_cdf >= 0.6). Per calendar month we report the
mean number of acquisition dates and of "usable" dates (clear share >= USABLE) per year.
Output: public/data/revisit.json
"""
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ee

PROJECT = "claudev1-503808"
SITES = {"hanoi": (105.833, 21.055), "angiang": (105.08, 10.45)}
YEARS = (2019, 2024)
CS = 0.6
USABLE = 0.9
OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "revisit.json"


def site_rows(lonlat: tuple[float, float]) -> list[dict]:
    geom = ee.Geometry.Point(lonlat).buffer(1000).bounds()
    col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(geom)
           .filterDate(f"{YEARS[0]}-01-01", f"{YEARS[1] + 1}-01-01")
           .linkCollection(ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"), ["cs_cdf"]))

    def f(img):
        frac = img.select("cs_cdf").gte(CS).reduceRegion(ee.Reducer.mean(), geom, 20).get("cs_cdf")
        return ee.Feature(None, {"date": img.date().format("YYYY-MM-dd"), "clear": frac})

    return [x["properties"] for x in ee.FeatureCollection(col.map(f)).getInfo()["features"]]


def summarise(rows: list[dict]) -> dict:
    best: dict[str, float] = {}
    for r in rows:
        if r.get("clear") is None:
            continue
        best[r["date"]] = max(best.get(r["date"], 0.0), r["clear"])
    n_years = YEARS[1] - YEARS[0] + 1
    acq, ok = defaultdict(int), defaultdict(int)
    for d, c in best.items():
        m = int(d[5:7])
        acq[m] += 1
        ok[m] += c >= USABLE
    return {
        "months": [{"m": m, "acq_per_year": round(acq[m] / n_years, 2), "usable_per_year": round(ok[m] / n_years, 2)}
                   for m in range(1, 13)],
        "total_dates": len(best), "usable_dates": sum(ok.values()),
    }


def main() -> None:
    ee.Initialize(project=PROJECT)
    out = {k: {"center_lonlat": v, **summarise(site_rows(v))} for k, v in SITES.items()}
    out["provenance"] = {
        "collection": "COPERNICUS/S2_SR_HARMONIZED + GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
        "box": "2 x 2 km around center_lonlat",
        "usable": f"clear share (cs_cdf >= {CS}) >= {USABLE}",
        "period": f"{YEARS[0]}-{YEARS[1]}; values are means per calendar month per year",
        "note": "Sentinel-2A and 2B both operating for the whole period (5-day revisit at the equator)",
        "script": "scripts/data/export_revisit.py",
        "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), "utf-8")
    for k in SITES:
        print(k, out[k]["total_dates"], "dates,", out[k]["usable_dates"], "usable;",
              [(r["m"], r["usable_per_year"]) for r in out[k]["months"]])


if __name__ == "__main__":
    main()
