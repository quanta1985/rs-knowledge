"""Chapter 1 data: every active satellite (CelesTrak GP) with a mission family, and catalogue statistics (CelesTrak SATCAT).

Usage:
    python -I scripts/data/export_ch01_satnow.py
Outputs:
    public/data/ch01-satnow.json  t0 + rows [NORAD, epoch offset from t0 (min), mean motion (rev/day), e, i, RAAN, argp, M, family]
    public/data/ch01-satcat.json  launches and payloads per year, objects in orbit by type, active payloads by owner, VN payloads
Family = first CelesTrak purpose group (in FAMILIES order) that lists the object; 'other' if none.
CelesTrak asks clients not to download the same GROUP more than once every 2 hours: run this at most that often.
"""
import csv
import io
import json
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UA = {"User-Agent": "rs-knowledge-handbook"}
# precedence matters: a weather satellite that also carries an Argos relay counts as weather
FAMILIES = {
    "nav": ["gnss", "sbas"],
    "weather": ["weather"],
    "eo": ["resource", "sar", "planet", "dmc", "spire"],
    "science": ["science", "geodetic", "stations"],
    "comms": ["starlink", "oneweb", "kuiper", "qianfan", "hulianwang", "intelsat", "ses", "eutelsat", "telesat",
              "iridium-NEXT", "orbcomm", "globalstar", "other-comm", "x-comm", "amateur", "satnogs", "tdrss", "argos", "sarsat"],
}
FAMILY_IDS = [*FAMILIES, "other"]
ACTIVE_CODES = set("+PBSX")  # SATCAT operational status: operational, partially, backup, spare, extended


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def group(name: str) -> list[dict]:
    try:
        return json.loads(get(f"https://celestrak.org/NORAD/elements/gp.php?GROUP={name}&FORMAT=json"))
    except (urllib.error.URLError, json.JSONDecodeError) as e:  # a group that does not exist returns text, not JSON
        print(f"  {name}: skipped ({e})")
        return []


def epoch(d: dict) -> datetime:
    return datetime.fromisoformat(d["EPOCH"]).replace(tzinfo=timezone.utc)


def satnow(now: str, names: dict[int, str]) -> None:
    active = group("active")
    if not active:
        sys.exit("CelesTrak 'active' group is empty: aborting so the old snapshot is kept")
    fam: dict[int, str] = {}
    for f, groups in FAMILIES.items():
        for g in groups:
            for d in group(g):
                fam.setdefault(d["NORAD_CAT_ID"], f)
    # stale element sets (epoch > 30 days old) belong to lost or decaying objects: drop them
    # t0 = retrieval time (some supplemental element sets carry epochs a few hours ahead), floored to the hour
    t0 = min(max(epoch(d) for d in active), datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
    rows = []
    for d in active:
        age_min = (epoch(d) - t0).total_seconds() / 60
        if age_min < -30 * 1440 or d.get("CENTER_NAME", "EARTH") != "EARTH":
            continue
        rows.append([d["NORAD_CAT_ID"], round(age_min, 1), round(d["MEAN_MOTION"], 6), round(d["ECCENTRICITY"], 5),
                     round(d["INCLINATION"], 2), round(d["RA_OF_ASC_NODE"], 2), round(d["ARG_OF_PERICENTER"], 1),
                     round(d["MEAN_ANOMALY"], 1), FAMILY_IDS.index(fam.get(d["NORAD_CAT_ID"], "other"))])
    names = {**names, **{d["NORAD_CAT_ID"]: d["OBJECT_NAME"] for d in active}}
    starlink = {k for k, v in names.items() if v.startswith("STARLINK")}  # by name: the starlink group is often rate-limited
    counts = Counter(FAMILY_IDS[r[8]] for r in rows)
    print(len(active), "active,", len(rows), "kept;", dict(counts), "starlink", len(starlink & {r[0] for r in rows}))
    out = ROOT / "public/data/ch01-satnow.json"
    out.write_text(json.dumps({
        "t0": t0.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fields": ["norad", "epochMin", "meanMotion", "e", "i", "raan", "argp", "M", "family"],
        "families": FAMILY_IDS,
        "starlink": sorted(starlink & {r[0] for r in rows}),
        # labelled on the globe
        "named": {str(k): names[k] for k in (25544, 48274, 32767, 38332, 39160, 68430, 20580) if k in names},
        "rows": rows,
        "provenance": {"source": "CelesTrak GP data (OMM JSON): group 'active' plus purpose groups for the family, https://celestrak.org",
                       "groups": FAMILIES, "retrieved": now, "script": "scripts/data/export_ch01_satnow.py",
                       "note": "Element sets older than 30 days dropped. Propagated as Kepler + J2 secular drift (src/lib/gnss.ts)."},
    }, separators=(",", ":")), "utf-8")
    print("->", out, f"{out.stat().st_size / 1024:.0f} KB")


def satcat(now: str) -> dict[int, str]:
    rows = list(csv.DictReader(io.StringIO(get("https://celestrak.org/pub/satcat.csv").decode("utf-8"))))
    launches, payloads = defaultdict(set), Counter()
    for r in rows:
        y = r["LAUNCH_DATE"][:4]
        launches[y].add(r["OBJECT_ID"][:8])  # 'YYYY-NNN': one international designator per launch that reached orbit
        if r["OBJECT_TYPE"] == "PAY":
            payloads[y] += 1
    in_orbit = Counter(r["OBJECT_TYPE"] for r in rows if not r["DECAY_DATE"] and r["ORBIT_CENTER"] == "EA")
    active = [r for r in rows if r["OPS_STATUS_CODE"] in ACTIVE_CODES and r["OPS_STATUS_CODE"]]
    vn = [{k: r[k] for k in ("OBJECT_NAME", "OBJECT_ID", "NORAD_CAT_ID", "OPS_STATUS_CODE", "LAUNCH_DATE", "LAUNCH_SITE", "DECAY_DATE", "APOGEE", "PERIGEE", "INCLINATION")}
          for r in rows if r["OWNER"] == "VTNM" or r["OBJECT_ID"] == "1980-064A"]  # 1980-064A = Soyuz 37 (Pham Tuan)
    last = max(r["LAUNCH_DATE"] for r in rows)
    out = ROOT / "public/data/ch01-satcat.json"
    out.write_text(json.dumps({
        "lastLaunch": last,
        "launches": {y: len(v) for y, v in sorted(launches.items())},
        "payloads": dict(sorted(payloads.items())),
        "inOrbit": dict(in_orbit),
        "activePayloads": len(active),
        "activeByOwner": dict(Counter(r["OWNER"] for r in active).most_common(8)),
        "vn": vn,
        "provenance": {"source": "CelesTrak SATCAT, https://celestrak.org/pub/satcat.csv", "retrieved": now,
                       "script": "scripts/data/export_ch01_satnow.py",
                       "note": "launches = distinct international designators (YYYY-NNN) per launch year, i.e. launches that put "
                               "at least one catalogued object in orbit; failed launches are not catalogued. "
                               "Active = OPS_STATUS_CODE in + P B S X."},
    }, ensure_ascii=False, indent=1), "utf-8")
    print("satcat", len(rows), "objects; last launch", last, "; in orbit", dict(in_orbit), "; active", len(active))
    return {int(r["NORAD_CAT_ID"]): r["OBJECT_NAME"] for r in rows}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    satnow(stamp, satcat(stamp))
