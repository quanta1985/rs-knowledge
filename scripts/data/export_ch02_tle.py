"""Chapter 2 data: one real two-line element set (VNREDSat-1) for the "read a TLE" figure.

Usage:
    python -I scripts/data/export_ch02_tle.py
Output: public/data/ch02-tle.json
"""
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NORAD = 39160  # VNREDSat-1
URL = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={NORAD}&FORMAT=TLE"

with urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "rs-knowledge-handbook"}), timeout=60) as r:
    lines = [ln.rstrip() for ln in r.read().decode("ascii").splitlines() if ln.strip()]
if len(lines) != 3 or not lines[1].startswith("1 ") or not lines[2].startswith("2 "):
    raise SystemExit(f"unexpected CelesTrak answer: {lines!r}")

out = {"name": lines[0].strip(), "line1": lines[1], "line2": lines[2],
       "provenance": {"source": URL, "retrieved": datetime.now(timezone.utc).isoformat(timespec="seconds")}}
(ROOT / "public/data/ch02-tle.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
print(out["name"], out["line1"], out["line2"], sep="\n")
