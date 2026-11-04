"""Chapter 3 data.

Usage:
    python -I scripts/data/export_ch03_physics.py solar   # ASTM G173-03 spectra -> public/data/ch03-solar.json
    python -I scripts/data/export_ch03_physics.py lst     # Landsat 9 ST_B10 on the Hanoi frame -> public/data/ch03-lst/

ASTM G173-03 (derived from SMARTS 2.9.2, U.S. Standard Atmosphere, air mass 1.5) is fetched from the copy shipped with
pvlib-python (identical to NREL's astmg173.csv). "Transmittance" = direct+circumsolar AM1.5 / extraterrestrial: the
fraction of sunlight that survives 1.5 air masses of that model atmosphere, not a measurement for Viet Nam.
"""
import gzip
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PROJECT = "claudev1-503808"
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")
G173 = "https://raw.githubusercontent.com/pvlib/pvlib-python/main/pvlib/data/ASTMG173.csv"


def solar() -> None:
    with urllib.request.urlopen(urllib.request.Request(G173, headers={"User-Agent": "rs-knowledge-handbook"}), timeout=60) as r:
        a = np.genfromtxt(io.StringIO(r.read().decode()), delimiter=",", skip_header=2)
    wl, etr, glob, direct = a.T
    # resample to a 5 nm grid below 1700 nm and 10 nm above (bin means), keeps every absorption band visible
    edges = np.concatenate([np.arange(280, 1700, 5), np.arange(1700, 4001, 10)])
    rows = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (wl >= lo) & (wl < hi)
        if not m.any():
            continue
        e, d = etr[m].mean(), direct[m].mean()
        rows.append([round((lo + hi) / 2, 1), round(e, 4), round(glob[m].mean(), 4), round(d, 4), round(d / e, 4) if e > 0 else 0])
    total = lambda y: float(np.trapezoid(y, wl))
    out = {"columns": ["nm", "etr", "global", "direct", "transmittance"], "rows": rows,
           "totals_w_m2": {"etr": round(total(etr), 1), "global": round(total(glob), 1), "direct": round(total(direct), 1)},
           "provenance": {"source": "ASTM G173-03 Reference Spectra Derived from SMARTS v2.9.2 (NREL), via pvlib-python data/ASTMG173.csv",
                          "units": "W m-2 nm-1", "resampling": "bin mean, 5 nm (< 1700 nm), 10 nm (>= 1700 nm)",
                          "transmittance": "direct+circumsolar (AM1.5) / extraterrestrial", "retrieved": NOW,
                          "script": "scripts/data/export_ch03_physics.py"}}
    (ROOT / "public/data/ch03-solar.json").write_text(json.dumps(out), "utf-8")
    print(len(rows), "rows", out["totals_w_m2"])


def lst() -> None:
    import ee
    ee.Initialize(project=PROJECT)
    s2 = json.loads((ROOT / "public/data/hanoi-s2/meta.json").read_text("utf-8"))
    x0, y1 = s2["origin_xy"]
    res, n = 30, -(-s2["width"] * s2["resolution_m"] // 30)  # ceil(5120 / 30) = 171
    img = ee.Image("LANDSAT/LC09/C02/T1_L2/LC09_127045_20231222")
    arr = ee.data.computePixels({
        "expression": img.select(["ST_B10"]), "fileFormat": "NUMPY_NDARRAY",
        "grid": {"dimensions": {"width": n, "height": n}, "crsCode": "EPSG:32648",
                 "affineTransform": {"scaleX": res, "shearX": 0, "translateX": x0, "shearY": 0, "scaleY": -res, "translateY": y1}},
    })
    dn = arr["ST_B10"].astype("<u2")
    out = ROOT / "public/data/ch03-lst"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(dn.tobytes(), compresslevel=9))
    props = img.toDictionary(["DATE_ACQUIRED", "SCENE_CENTER_TIME", "CLOUD_COVER"]).getInfo()
    meta = {"width": n, "height": n, "resolution_m": res, "crs": "EPSG:32648", "origin_xy": [x0, y1], "bands": ["st"],
            "dtype": "uint16", "layout": "BSQ", "scale": 0.00341802, "offset": 149.0, "unit": "K (surface temperature)",
            "date": props["DATE_ACQUIRED"], "time_utc": props["SCENE_CENTER_TIME"], "cloud_cover": props["CLOUD_COVER"],
            "provenance": {"collection": "LANDSAT/LC09/C02/T1_L2 ST_B10 (USGS single-channel algorithm, ASTER GED emissivity)",
                           "scene": "LC09_127045_20231222", "resampling": "nearest neighbour to 30 m UTM 48N, same upper-left corner as the S2 cube",
                           "script": "scripts/data/export_ch03_physics.py", "exported": NOW, "attribution": "Landsat courtesy of USGS"}}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    k = dn * 0.00341802 + 149.0
    k[dn == 0] = np.nan
    ref = json.loads((ROOT / "public/data/hanoi-s2/reference.json").read_text("utf-8"))["points"]
    for p in ref:
        r, c = p["row"] * 10 // 30, p["col"] * 10 // 30
        w = k[r - 1:r + 2, c - 1:c + 2]
        print(p["id"], round(float(np.nanmean(w)) - 273.15, 1), "C")
    print("frame", np.nanpercentile(k - 273.15, [2, 50, 98]).round(1), "nodata", int((dn == 0).sum()), meta["date"], meta["time_utc"])


if __name__ == "__main__":
    for t in sys.argv[1:] or ["solar", "lst"]:
        {"solar": solar, "lst": lst}[t]()
