"""West Lake as raster and as vector for Chapter 5 (no Earth Engine needed; reads the Chapter 6 cube).

Usage:
    python -I scripts/data/export_ch05_westlake.py

Water = MNDWI = (B3 - B11) / (B3 + B11) >= 0 on the 12 Feb 2024 Sentinel-2 scene; keep the 8-connected component
that contains the West Lake reference pixel (row 300, col 160), with interior holes filled only if smaller than 4 px.
Outputs public/data/ch05-westlake/{bands.u16z, meta.json} (mask, uint16 0/1) and polygon.json (UTM 48N rings, metres).
"""
import gzip
import json
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage
from skimage import measure

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public/data/hanoi-s2"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    meta = json.loads((SRC / "meta.json").read_text("utf-8"))
    n = meta["width"]
    cube = np.frombuffer(gzip.decompress((SRC / "bands.u16z").read_bytes()), "<u2").reshape(len(meta["bands"]), n, n).astype(float)
    g, s = cube[meta["bands"].index("B3")], cube[meta["bands"].index("B11")]
    water = (g - s) / np.maximum(g + s, 1) >= 0
    lab, _ = ndimage.label(water, structure=np.ones((3, 3)))
    lake = lab == lab[300, 160]
    holes = ndimage.binary_fill_holes(lake) & ~lake
    hl, _ = ndimage.label(holes)
    small = np.isin(hl, [i for i, c in enumerate(np.bincount(hl.ravel())) if i and c < 4])
    lake |= small
    x0, y1 = meta["origin_xy"]
    res = meta["resolution_m"]
    # contours at 0.5 on a padded mask trace the pixel boundary midway between centres
    rings = []
    for c in measure.find_contours(np.pad(lake.astype(float), 1), 0.5):
        r, k = c[:, 0] - 1, c[:, 1] - 1
        ring = [[round(x0 + (cc + 0.5) * res, 1), round(y1 - (rr + 0.5) * res, 1)] for rr, cc in zip(r, k)]
        xy = np.array(ring)
        area = 0.5 * np.sum(xy[:-1, 0] * xy[1:, 1] - xy[1:, 0] * xy[:-1, 1])
        if abs(area) >= 4 * res * res:
            rings.append((abs(area), ring))
    rings.sort(key=lambda t: -t[0])
    out = ROOT / "public/data/ch05-westlake"
    out.mkdir(parents=True, exist_ok=True)
    (out / "bands.u16z").write_bytes(gzip.compress(lake.astype("<u2").tobytes(), compresslevel=9))
    m = {k: meta[k] for k in ("width", "height", "resolution_m", "crs", "origin_xy")}
    m.update(bands=["water"], dtype="uint16", layout="BSQ", scale=1, date=meta["date"],
             provenance={"source": "Sentinel-2B L2A 2024-02-12 (public/data/hanoi-s2)", "rule": "MNDWI (B3, B11) >= 0, component containing row 300 col 160",
                         "script": "scripts/data/export_ch05_westlake.py", "attribution": "Contains modified Copernicus Sentinel data 2024"})
    (out / "meta.json").write_text(json.dumps(m, ensure_ascii=False, indent=1), "utf-8")
    (out / "polygon.json").write_text(json.dumps({"crs": meta["crs"], "outer": rings[0][1], "holes": [r for _, r in rings[1:]]}), "utf-8")
    print("pixels", int(lake.sum()), "area raster km2 %.3f" % (lake.sum() * res * res / 1e6))
    print("outer vertices", len(rings[0][1]), "area %.3f km2" % (rings[0][0] / 1e6), "holes", len(rings) - 1, [round(a / 1e6, 4) for a, _ in rings[1:]])


if __name__ == "__main__":
    main()
