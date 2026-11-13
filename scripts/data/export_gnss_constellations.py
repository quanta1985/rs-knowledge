"""Chapter 7 (GNSS) data: a snapshot of real GP mean elements for the four global constellations from CelesTrak.

Usage:
    python -I scripts/data/export_gnss_constellations.py
Output: public/data/gnss/constellations.json
    t0  = the reference instant used by every figure and number in the chapter (newest epoch, floored to the hour)
    sats = [system, name, NORAD id, epoch, mean motion (rev/day), e, i, RAAN, argp, M]  (degrees)
CelesTrak asks clients not to download the same GROUP more than once every 2 hours.
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GROUPS = {"GPS": "gps-ops", "Galileo": "galileo", "GLONASS": "glo-ops", "BeiDou": "beidou"}
KEYS = ["EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY"]


def fetch(group: str) -> list[dict]:
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json"
    req = urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sats = []
    for system, group in GROUPS.items():
        rows = fetch(group)
        for d in rows:
            sats.append([system, d["OBJECT_NAME"], d["NORAD_CAT_ID"], d["EPOCH"], *[d[k] for k in KEYS[1:]]])
        print(f"{system:8s} {len(rows):3d} objects")
    newest = max(datetime.fromisoformat(s[3]).replace(tzinfo=timezone.utc) for s in sats)
    t0 = newest.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = ROOT / "public/data/gnss/constellations.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "t0": t0,
        "fields": ["system", "name", "norad", "epoch", "meanMotion", "e", "i", "raan", "argp", "M"],
        "sats": sats,
        "provenance": {"source": "CelesTrak GP data (OMM JSON), groups " + ", ".join(GROUPS.values()) + ", https://celestrak.org",
                       "retrieved": now, "script": "scripts/data/export_gnss_constellations.py",
                       "note": "SGP4 mean elements, propagated in the handbook as Keplerian orbits with J2 secular drift (src/lib/gnss.ts)."},
    }, ensure_ascii=False), "utf-8")
    print("t0", t0, "->", out)


if __name__ == "__main__":
    main()
