"""Chapters 1-2 data: real orbital elements (CelesTrak GP) and real scene footprints (Earth Engine).

Usage:
    python -I scripts/data/export_ch01_missions.py            # both
    python -I scripts/data/export_ch01_missions.py gp         # CelesTrak only (no EE)
Outputs: public/data/ch01-missions.json, public/data/ch01-footprints.json, public/data/ch02-vietnam.json
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROJECT = "claudev1-503808"
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")

# NORAD id -> (display name, sensor family, colour). Colours: Okabe-Ito.
SATS = {
    40697: ("Sentinel-2A", "optical", "#009E73"), 42063: ("Sentinel-2B", "optical", "#009E73"), 60989: ("Sentinel-2C", "optical", "#009E73"),
    39634: ("Sentinel-1A", "sar", "#56B4E9"), 62261: ("Sentinel-1C", "sar", "#56B4E9"), 66315: ("Sentinel-1D", "sar", "#56B4E9"),
    39084: ("Landsat 8", "optical", "#E69F00"), 49260: ("Landsat 9", "optical", "#E69F00"),
    25994: ("Terra (MODIS)", "optical", "#CC79A7"), 27424: ("Aqua (MODIS)", "optical", "#CC79A7"),
    39160: ("VNREDSat-1", "optical", "#D55E00"),
}


def gp() -> None:
    rows = []
    for norad, (name, kind, color) in SATS.items():
        url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=json"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"}), timeout=60) as r:
            d = json.load(r)[0]
        keep = ["OBJECT_NAME", "OBJECT_ID", "NORAD_CAT_ID", "EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION",
                "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY"]
        rows.append({"name": name, "kind": kind, "color": color, **{k: d[k] for k in keep}})
        print(name, d["EPOCH"], d["INCLINATION"], d["MEAN_MOTION"])
    (ROOT / "public/data/ch01-missions.json").write_text(json.dumps({
        "satellites": rows,
        "provenance": {"source": "CelesTrak GP data (OMM JSON), https://celestrak.org", "retrieved": NOW,
                       "script": "scripts/data/export_ch01_missions.py",
                       "note": "Mean elements for SGP4; the handbook propagates them as circular orbits with J2 node drift (illustrative)."},
    }, ensure_ascii=False, indent=1), "utf-8")


def footprints() -> None:
    import ee
    ee.Initialize(project=PROJECT)
    hanoi = ee.Geometry.Point([105.83, 21.05])
    s1 = (ee.ImageCollection("COPERNICUS/S1_GRD").filterBounds(hanoi).filterDate("2024-02-12", "2024-02-13")
          .filter(ee.Filter.eq("relativeOrbitNumber_start", 128)).first())
    items = [
        ("s2", "Sentinel-2 L2A tile T48QWJ (12/02/2024)", ee.Image("COPERNICUS/S2_SR_HARMONIZED/20240212T032849_20240212T033821_T48QWJ")),
        ("l9", "Landsat 9 path 127 row 45 (22/12/2023)", ee.Image("LANDSAT/LC09/C02/T1_L2/LC09_127045_20231222")),
        ("s1", "Sentinel-1A IW GRD frame (12/02/2024)", s1),
    ]
    feats = []
    for key, label, img in items:
        g = ee.Geometry(img.get("system:footprint"))
        poly = ee.Geometry.Polygon(g.coordinates()) if g.type().getInfo() == "LinearRing" else g
        info = poly.simplify(200).getInfo()
        area = poly.area(1000).divide(1e6).getInfo()
        feats.append({"type": "Feature", "properties": {"id": key, "label": label, "area_km2": round(area)}, "geometry": info})
        print(key, round(area), "km2")
    (ROOT / "public/data/ch01-footprints.json").write_text(json.dumps({
        "type": "FeatureCollection", "features": feats,
        "provenance": {"source": "Earth Engine system:footprint of each scene, simplified to 200 m", "retrieved": NOW,
                       "script": "scripts/data/export_ch01_missions.py",
                       "attribution": "Contains modified Copernicus Sentinel data 2024; Landsat courtesy of USGS"},
    }, ensure_ascii=False), "utf-8")

    vn = (ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(ee.Filter.eq("country_na", "Vietnam")).geometry()
          .simplify(2000)).getInfo()
    # simplify() can return a GeometryCollection with degenerate LineStrings: keep the polygons only
    parts = vn["geometries"] if vn["type"] == "GeometryCollection" else [vn]
    polys = [g["coordinates"] for g in parts if g["type"] == "Polygon"] + [c for g in parts if g["type"] == "MultiPolygon" for c in g["coordinates"]]
    vn = {"type": "MultiPolygon", "coordinates": polys}
    (ROOT / "public/data/ch02-vietnam.json").write_text(json.dumps({
        "type": "Feature", "properties": {"source": "USDOS LSIB_SIMPLE 2017 (country_na = Vietnam), simplified 2 km; used only to sample land points",
                                          "retrieved": NOW}, "geometry": vn,
    }), "utf-8")
    print("vietnam ok")


if __name__ == "__main__":
    tasks = sys.argv[1:] or ["gp", "footprints"]
    for t in tasks:
        {"gp": gp, "footprints": footprints}[t]()
