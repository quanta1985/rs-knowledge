"""Data for Chapter 13 (Viet Nam case studies).

Usage:
    python -I scripts/data/export_ch13_cases.py [forest no2 lst]

forest: Hansen Global Forest Change v1.13, Central Highlands (5 provinces, pre-2025 boundaries from FAO GAUL 2015)
        -> public/data/ch13-forest/{meta.json, bands.u16z, provinces.json}
no2:    Sentinel-5P TROPOMI L3 tropospheric NO2, 2024 mean grid over Viet Nam + monthly series 2019-2024 at 3 sites
        -> public/data/ch13-no2/{meta.json, bands.u16z, series.json}
lst:    Landsat 8/9 C2 L2 surface temperature, Ho Chi Minh City, dry-season 2024 median + ESA WorldCover classes
        -> public/data/ch13-lst/{meta.json, bands.u16z}
All grids are written as gzip'd band-sequential integers (.u16z), like the other products of the handbook.
"""
import gzip
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import ee
import numpy as np

warnings.filterwarnings("ignore", category=DeprecationWarning)
sys.stdout.reconfigure(encoding="utf-8")
PROJECT = "claudev1-503808"
ROOT = Path(__file__).resolve().parents[2] / "public/data"
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")


def pixels(img: ee.Image, grid: dict) -> dict:
    arr = ee.data.computePixels({"expression": img, "fileFormat": "NUMPY_NDARRAY", "grid": grid})
    return {b: arr[b] for b in arr.dtype.names}


def geo_grid(w: float, s: float, e: float, n: float, step: float) -> dict:
    nx, ny = round((e - w) / step), round((n - s) / step)
    return {"dimensions": {"width": nx, "height": ny}, "crsCode": "EPSG:4326",
            "affineTransform": {"scaleX": step, "shearX": 0, "translateX": w, "shearY": 0, "scaleY": -step, "translateY": n}}


def write(dirname: str, bands: dict, meta: dict, dtype: str) -> None:
    out = ROOT / dirname
    out.mkdir(parents=True, exist_ok=True)
    names = list(bands)
    cube = np.stack([bands[b] for b in names]).astype("<i2" if dtype == "int16" else "<u2")
    (out / "bands.u16z").write_bytes(gzip.compress(cube.tobytes(), compresslevel=9))
    h, w = cube.shape[1:]
    (out / "meta.json").write_text(json.dumps({"width": w, "height": h, "bands": names, "dtype": dtype, "layout": "BSQ", **meta},
                                              ensure_ascii=False, indent=1), "utf-8")
    print(dirname, cube.shape, (out / "bands.u16z").stat().st_size // 1024, "KB")


# ---------------------------------------------------------------- forest loss
HIGHLANDS = ["Kon Tum", "Gia Lai", "Dak Lak", "Dak Nong", "Lam Dong"]
VI_NAME = {"Kon Tum": "Kon Tum", "Gia Lai": "Gia Lai", "Dak Lak": "Đắk Lắk", "Dak Nong": "Đắk Nông", "Lam Dong": "Lâm Đồng"}


def forest() -> None:
    gfc = ee.Image("UMD/hansen/global_forest_change_2025_v1_13")
    prov = ee.FeatureCollection("FAO/GAUL/2015/level1").filter(ee.Filter.eq("ADM0_NAME", "Viet Nam")) \
        .filter(ee.Filter.inList("ADM1_NAME", HIGHLANDS))
    forest2000 = gfc.select("treecover2000").gte(30)  # Hansen et al. (2013) canopy threshold commonly used: >= 30 %
    area = ee.Image.pixelArea().divide(1e4)  # ha
    lossyear = gfc.select("lossyear")
    # loss area per year (ha) per province: group by lossyear
    stats = area.updateMask(forest2000.And(gfc.select("loss"))).addBands(lossyear).reduceRegions(
        collection=prov, reducer=ee.Reducer.sum().group(groupField=1, groupName="year"), scale=30, tileScale=8)
    base = area.updateMask(forest2000).reduceRegions(collection=prov, reducer=ee.Reducer.sum(), scale=30, tileScale=8)
    rows = {f["properties"]["ADM1_NAME"]: f["properties"]["groups"] for f in stats.getInfo()["features"]}
    f2000 = {f["properties"]["ADM1_NAME"]: f["properties"]["sum"] for f in base.getInfo()["features"]}
    years = list(range(2001, 2026))
    table = []
    for p in HIGHLANDS:
        by = {int(g["year"]): g["sum"] for g in rows[p]}
        table.append({"id": p, "name": {"vi": VI_NAME[p], "en": p}, "forest2000_ha": round(f2000[p]),
                      "loss_ha": [round(by.get(y - 2000, 0)) for y in years]})
    # outlines for the map (simplified 500 m)
    geo = prov.map(lambda f: f.simplify(500).select(["ADM1_NAME"])).getInfo()
    for f in geo["features"]:
        f["properties"] = {"id": f["properties"]["ADM1_NAME"], "vi": VI_NAME[f["properties"]["ADM1_NAME"]], "en": f["properties"]["ADM1_NAME"]}
    # 0.004 deg grid: share of 2000-forest lost (%) and mean loss year of the lost pixels
    bounds = prov.geometry().bounds().getInfo()["coordinates"][0]
    w, s = min(c[0] for c in bounds), min(c[1] for c in bounds)
    e, n = max(c[0] for c in bounds), max(c[1] for c in bounds)
    w, s, e, n = [round(v, 2) for v in (w - 0.02, s - 0.02, e + 0.02, n + 0.02)]
    step = 0.004
    lost = forest2000.And(gfc.select("loss"))
    inside = ee.Image.constant(1).clip(prov).mask()
    stack = (lost.multiply(100).rename("loss_pct")
             .addBands(lossyear.updateMask(lost).rename("loss_year"))
             .addBands(forest2000.multiply(100).rename("forest_pct")))
    agg = stack.reduceResolution(ee.Reducer.mean(), maxPixels=1024).reproject(ee.Projection("EPSG:4326").scale(step, step))
    agg = agg.updateMask(inside).unmask(0).round().toUint16()
    b = pixels(agg, geo_grid(w, s, e, n, step))
    write("ch13-forest", {"loss_pct": b["loss_pct"], "loss_year": b["loss_year"], "forest_pct": b["forest_pct"]}, {
        "bbox": [w, s, e, n], "step_deg": step, "years": years, "provinces": table,
        "provenance": {"collection": "UMD/hansen/global_forest_change_2025_v1_13 (Hansen et al. 2013, updated to 2025)",
                       "forest": "treecover2000 >= 30 %", "boundaries": "FAO GAUL 2015 level 1 (pre-2025 provinces)",
                       "grid": f"{step} deg; loss_pct = % of 30 m pixels that were forest in 2000 and lost 2001-2025; "
                               "loss_year = mean loss year (1 = 2001) of those pixels; forest_pct = % forest in 2000",
                       "script": "scripts/data/export_ch13_cases.py", "exported": NOW}}, "uint16")
    (ROOT / "ch13-forest/provinces.json").write_text(json.dumps(geo, ensure_ascii=False), "utf-8")
    tot = [sum(t["loss_ha"][i] for t in table) for i in range(len(years))]
    print("forest2000 ha", {t["id"]: t["forest2000_ha"] for t in table})
    print("loss total ha by year", dict(zip(years, tot)))


# ---------------------------------------------------------------- NO2
SITES = {
    "hanoi": {"lon": 105.85, "lat": 21.03, "vi": "Hà Nội (nội thành)", "en": "Hanoi (urban core)"},
    "hcmc": {"lon": 106.70, "lat": 10.78, "vi": "TP. Hồ Chí Minh (nội thành)", "en": "Ho Chi Minh City (urban core)"},
    "laichau": {"lon": 103.30, "lat": 22.40, "vi": "Vùng núi Lai Châu (nông thôn)", "en": "Lai Chau highlands (rural)"},
}
NO2_SCALE = 1e6  # mol/m2 -> umol/m2


def no2() -> None:
    col = ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2").select("tropospheric_NO2_column_number_density")
    w, s, e, n, step = 102.0, 8.4, 110.0, 23.6, 0.05
    mean24 = col.filterDate("2024-01-01", "2025-01-01").mean().multiply(NO2_SCALE)
    img = mean24.reproject(ee.Projection("EPSG:4326").scale(step, step))  # nearest from 0.01 deg L3 grid
    b = pixels(img.unmask(-1).multiply(10).round().toInt16(), geo_grid(w, s, e, n, step))
    write("ch13-no2", {"no2": b["tropospheric_NO2_column_number_density"]}, {
        "bbox": [w, s, e, n], "step_deg": step, "scale": 0.1, "unit": "µmol/m² (tropospheric NO2 column)", "nodata": -10,
        "provenance": {"collection": "COPERNICUS/S5P/OFFL/L3_NO2 (TROPOMI, harpconvert L3, qa_value > 0.75)",
                       "statistic": "mean of all 2024 daily L3 images; nearest-neighbour sample at 0.05 deg",
                       "script": "scripts/data/export_ch13_cases.py", "exported": NOW}}, "int16")
    pts = ee.FeatureCollection([ee.Feature(ee.Geometry.Point([v["lon"], v["lat"]]).buffer(10000), {"id": k}) for k, v in SITES.items()])

    def per_month(d):
        d = ee.Date(d)
        m = col.filterDate(d, d.advance(1, "month")).mean().multiply(NO2_SCALE)
        return m.reduceRegions(pts, ee.Reducer.mean(), 1113).map(lambda f: f.set("month", d.format("YYYY-MM")))

    fc = []
    for y in range(2019, 2025):  # one request per year: a single 72-month map hits "Too many concurrent aggregations"
        months = ee.List([f"{y}-{m:02d}-01" for m in range(1, 13)])
        fc += ee.FeatureCollection(months.map(per_month)).flatten().getInfo()["features"]
    series = {k: [] for k in SITES}
    for f in fc:
        p = f["properties"]
        if p.get("mean") is not None:
            series[p["id"]].append({"month": p["month"], "no2": round(p["mean"], 1)})
    for k in series:
        series[k].sort(key=lambda r: r["month"])
    site_mean = {}
    for k, v in SITES.items():
        r = mean24.reduceRegion(ee.Reducer.mean(), ee.Geometry.Point([v["lon"], v["lat"]]).buffer(10000), 1113).getInfo()
        site_mean[k] = round(r["tropospheric_NO2_column_number_density"], 1)
    (ROOT / "ch13-no2/series.json").write_text(json.dumps({
        "sites": {k: {**v, "mean2024": site_mean[k]} for k, v in SITES.items()}, "series": series, "unit": "µmol/m²",
        "provenance": {"collection": "COPERNICUS/S5P/OFFL/L3_NO2 tropospheric_NO2_column_number_density",
                       "statistic": "monthly mean of daily L3 images, then mean over a 10 km radius disc around each site",
                       "script": "scripts/data/export_ch13_cases.py", "exported": NOW}}, ensure_ascii=False, indent=1), "utf-8")
    print("2024 mean umol/m2", site_mean)


# ---------------------------------------------------------------- land surface temperature
def lst() -> None:
    x0, y1, size, res = 670000, 1210000, 40000, 100  # UTM 48N, 40 x 40 km over central HCMC
    frame = ee.Geometry.Rectangle([x0, y1 - size, x0 + size, y1], ee.Projection("EPSG:32648"), False)

    def prep(img):
        qa = img.select("QA_PIXEL")
        clear = qa.bitwiseAnd(0b11110).eq(0)  # dilated cloud, cirrus, cloud, shadow
        t = img.select("ST_B10").multiply(0.00341802).add(149.0 - 273.15).rename("lst")
        return t.updateMask(clear)

    col = (ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").merge(ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"))
           .filterBounds(frame).filterDate("2024-01-01", "2024-05-01").filter(ee.Filter.lt("CLOUD_COVER", 30)))
    ids = col.aggregate_array("LANDSAT_PRODUCT_ID").getInfo()
    med = col.map(prep).median()
    wc = ee.ImageCollection("ESA/WorldCover/v200").first().rename("lc")
    stack = med.multiply(100).round().toInt16().addBands(wc.toInt16())
    grid = {"dimensions": {"width": size // res, "height": size // res}, "crsCode": "EPSG:32648",
            "affineTransform": {"scaleX": res, "shearX": 0, "translateX": x0, "shearY": 0, "scaleY": -res, "translateY": y1}}
    b = pixels(stack.unmask(-32768), grid)
    t = b["lst"].astype(float) / 100
    t[b["lst"] == -32768] = np.nan
    names = {10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built", 60: "bare", 80: "water", 90: "wetland", 95: "mangrove"}
    by = {names[c]: round(float(np.nanmean(t[b["lc"] == c])), 1) for c in names if (b["lc"] == c).sum() > 200}
    share = {names[c]: round(float((b["lc"] == c).mean() * 100), 1) for c in names}
    write("ch13-lst", {"lst": b["lst"], "lc": b["lc"]}, {
        "origin_xy": [x0, y1], "crs": "EPSG:32648", "resolution_m": res, "scale": 0.01, "unit": "°C", "nodata": -32768,
        "scenes": ids, "class_mean_c": by, "class_share_pct": share,
        "provenance": {"collection": "LANDSAT/LC08 + LC09 C02/T1_L2 ST_B10 (x 0.00341802 + 149.0 K), Jan-Apr 2024, CLOUD_COVER < 30",
                       "mask": "QA_PIXEL bits 1-4 (dilated cloud, cirrus, cloud, shadow)", "statistic": "per-pixel median",
                       "landcover": "ESA WorldCover v200 (2021), nearest at 100 m",
                       "script": "scripts/data/export_ch13_cases.py", "exported": NOW}}, "int16")
    print("scenes", len(ids), "class means", by, "share", share)
    print("p5/p50/p95", np.nanpercentile(t, [5, 50, 95]).round(1))


if __name__ == "__main__":
    ee.Initialize(project=PROJECT)
    for task in sys.argv[1:] or ["forest", "no2", "lst"]:
        {"forest": forest, "no2": no2, "lst": lst}[task]()
