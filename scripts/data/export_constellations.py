"""Chapter 6 (LEO constellations) data: a snapshot of real GP mean elements of Starlink, OneWeb, Kuiper, Qianfan and
Guowang from CelesTrak, plus the Starlink launch/re-entry history from the CelesTrak SATCAT.

Usage:
    python -I scripts/data/export_constellations.py            # fresh snapshot of every group (changes t0 and every number)
    python -I scripts/data/export_constellations.py --add Qianfan Guowang   # add groups to the existing file, keep t0
    python -I scripts/data/export_constellations.py --history  # public/data/constellations/history.json only
Output: public/data/constellations/leo.json (compact: only what the figures propagate)
    t0   = reference instant of every figure and number in the chapter (newest epoch, floored to the hour)
    sats = {fleet: [[NORAD id, epoch offset from t0 (min), mean motion (rev/day), e, i, RAAN, argp, M], ...]}  (degrees)
CelesTrak asks clients not to download the same GROUP more than once every 2 hours.
"""
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GROUPS = {"Starlink": "starlink", "OneWeb": "oneweb", "Kuiper": "kuiper", "Qianfan": "qianfan", "Guowang": "hulianwang"}
OUT = ROOT / "public/data/constellations/leo.json"
HISTORY = ROOT / "public/data/constellations/history.json"


def fetch(group: str) -> list[dict]:
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json"
    req = urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except (urllib.error.URLError, json.JSONDecodeError) as e:  # a group that does not exist returns text, not JSON
        print(f"  {group}: skipped ({e})")
        return []


def epoch(d: dict) -> datetime:
    return datetime.fromisoformat(d["EPOCH"]).replace(tzinfo=timezone.utc)


def rows_of(rows: list[dict], t0: datetime) -> list[list]:
    return [[d["NORAD_CAT_ID"], round((epoch(d) - t0).total_seconds() / 60, 1), round(d["MEAN_MOTION"], 6),
             round(d["ECCENTRICITY"], 6), round(d["INCLINATION"], 3), round(d["RA_OF_ASC_NODE"], 3),
             round(d["ARG_OF_PERICENTER"], 2), round(d["MEAN_ANOMALY"], 2)] for d in rows]


def history(now: str) -> None:
    """Starlink payloads launched and re-entered per calendar year (CelesTrak SATCAT, name search STARLINK)."""
    url = "https://celestrak.org/satcat/records.php?NAME=STARLINK&FORMAT=json"
    req = urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"})
    with urllib.request.urlopen(req, timeout=180) as r:
        cat = [d for d in json.load(r) if d["OBJECT_TYPE"] == "PAY"]
    years = sorted({d["LAUNCH_DATE"][:4] for d in cat})
    launches = {y: len({d["OBJECT_ID"][:8] for d in cat if d["LAUNCH_DATE"][:4] == y}) for y in years}
    HISTORY.write_text(json.dumps({
        "years": [int(y) for y in years],
        "launched": [sum(d["LAUNCH_DATE"][:4] == y for d in cat) for y in years],
        "reentered": [sum((d["DECAY_DATE"] or "")[:4] == y for d in cat) for y in years],
        "launches": [launches[y] for y in years],
        "starship": sum(d["LAUNCH_SITE"] == "STARB" for d in cat),
        "onOrbit": sum(not d["DECAY_DATE"] for d in cat), "total": len(cat),
        "lastLaunch": max(d["LAUNCH_DATE"] for d in cat),
        "provenance": {"source": "CelesTrak SATCAT, payloads named STARLINK, https://celestrak.org/satcat/", "retrieved": now,
                       "script": "scripts/data/export_constellations.py --history",
                       "note": "launches = distinct international designators (YYYY-NNN) carrying Starlink payloads"},
    }, separators=(",", ":")), "utf-8")
    print("history", len(cat), "payloads ->", HISTORY)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if "--history" in sys.argv:
        return history(now)
    if "--add" in sys.argv:  # extra groups on the existing snapshot's t0, so the chapter's numbers stay valid
        old = json.loads(OUT.read_text("utf-8"))
        t0 = datetime.fromisoformat(old["t0"].replace("Z", "+00:00"))
        for fleet in sys.argv[sys.argv.index("--add") + 1:]:
            rows = fetch(GROUPS[fleet])
            if rows:
                old["sats"][fleet] = rows_of(rows, t0)
                old["provenance"].setdefault("added", {})[fleet] = {"group": GROUPS[fleet], "retrieved": now}
                print(f"{fleet:9s} {len(rows):5d} objects added")
        OUT.write_text(json.dumps(old, separators=(",", ":")), "utf-8")
        return
    raw = {fleet: fetch(group) for fleet, group in GROUPS.items()}
    raw = {k: v for k, v in raw.items() if v}
    newest = max(epoch(d) for rows in raw.values() for d in rows)
    t0 = newest.replace(minute=0, second=0, microsecond=0)
    sats = {}
    for fleet, rows in raw.items():
        sats[fleet] = rows_of(rows, t0)
        print(f"{fleet:9s} {len(rows):5d} objects")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "t0": t0.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fields": ["norad", "epochMin", "meanMotion", "e", "i", "raan", "argp", "M"],
        "sats": sats,
        "provenance": {"source": "CelesTrak GP data (OMM JSON), groups " + ", ".join(GROUPS[k] for k in raw) + ", https://celestrak.org",
                       "retrieved": now, "script": "scripts/data/export_constellations.py",
                       "note": "SGP4 mean elements, propagated in the handbook as Keplerian orbits with J2 secular drift (src/lib/gnss.ts)."},
    }, separators=(",", ":")), "utf-8")
    print("t0", t0.isoformat(), "->", OUT, f"{OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
