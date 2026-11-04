"""Suggested training pixels for the Chapter 9 classifier (a 'teacher's sample').

Usage:
    python -I scripts/data/export_ch09_training.py

For each of the 5 classes, picks pixels whose 5x5 WorldCover neighbourhood is homogeneous in that class and whose
3x3 Sentinel-2 neighbourhood is spectrally uniform, spread over the frame (seeded). Writes
public/data/ch09-worldcover/training.json. Training pixels are only a handful per class, so they are a negligible
part of the random validation samples drawn later in the browser.
"""
import gzip
import json
import sys
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
CLASSES = {  # class index: WorldCover codes
    0: [80, 90],        # water
    1: [10],            # tree cover
    2: [20, 30, 40],    # low vegetation: shrub, grass, cropland
    3: [50],            # built-up
    4: [60],            # bare / sparse
}
PER_CLASS = 8
FEATURES = ["B2", "B3", "B4", "B8", "B11", "B12"]

meta = json.loads((ROOT / "public/data/hanoi-s2/meta.json").read_text("utf-8"))
n = meta["width"]
s2 = np.frombuffer(gzip.decompress((ROOT / "public/data/hanoi-s2/bands.u16z").read_bytes()), "<u2").reshape(len(meta["bands"]), n, n)
s2 = s2[[meta["bands"].index(b) for b in FEATURES]].astype("f4") * meta["scale"]
wc = np.frombuffer(gzip.decompress((ROOT / "public/data/ch09-worldcover/bands.u16z").read_bytes()), "<u2").reshape(n, n)

cls = np.full((n, n), 255, "u1")
for k, codes in CLASSES.items():
    cls[np.isin(wc, codes)] = k
homog = np.zeros((n, n), bool)
win = sliding_window_view(cls, (5, 5))
homog[2:-2, 2:-2] = (win == win[..., 2:3, 2:3]).all(axis=(-1, -2))
sd = np.zeros((n, n), "f4")
sd[1:-1, 1:-1] = sliding_window_view(s2, (3, 3), axis=(1, 2)).std(axis=(-1, -2)).max(axis=0)

rng = np.random.default_rng(2024)
points = []
for k in CLASSES:
    # strict first (uniform spectra, >= 40 px apart); rare classes (sand bars) fall back to WorldCover-homogeneous, >= 12 px
    chosen: list[tuple[int, int]] = []
    for mask, gap in [((cls == k) & homog & (sd < 0.02), 40), ((cls == k) & homog, 12)]:
        ok = np.argwhere(mask)
        for r, c in ok[rng.permutation(len(ok))]:
            if len(chosen) == PER_CLASS:
                break
            if all(abs(r - a) + abs(c - b) > gap for a, b in chosen):
                chosen.append((int(r), int(c)))
    points += [{"cls": k, "row": r, "col": c} for r, c in chosen]
    print(k, "->", len(chosen))

out = {"classes": {str(k): v for k, v in CLASSES.items()}, "features": FEATURES, "points": points,
       "provenance": "scripts/data/export_ch09_training.py (WorldCover-homogeneous 5x5, S2 3x3 max band sd < 0.02, >= 40 px apart, seed 2024)"}
(ROOT / "public/data/ch09-worldcover/training.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), "utf-8")
