"""Chapter 4 (satellite-bus) data, each part optional on the command line (default: all):

    gp       real GP elements of the example satellites (CelesTrak)              -> sats.json
    density  global-mean thermosphere density, NRLMSIS 2.1 (pymsis), low/high Sun -> density.json
    saa      IGRF-14 total field intensity at 500 km, epoch 2026.0 (NOAA NCEI)      -> igrf500.json
    satcat   altitude histogram of catalogued objects in Earth orbit (CelesTrak)  -> debris.json

    python -I scripts/data/export_bus_data.py [gp density saa satcat]   -> public/data/satellite-bus/
Needs: pip install pymsis scipy; network for CelesTrak and NCEI.
"""
import csv, io, json, math, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pymsis

OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "satellite-bus"
SATS = {39160: "VNREDSAT 1", 40697: "SENTINEL-2A", 42063: "SENTINEL-2B", 60989: "SENTINEL-2C"}
# Solar activity: F10.7 (sfu) for a quiet and an active Sun; Ap = 15 (moderate geomagnetic activity) in both cases.
ACTIVITY = {"low": 70.0, "high": 200.0}
ALTS = np.arange(100, 1001, 10)  # km


def gp(norad: int) -> dict:
    url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=JSON"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"}), timeout=60) as r:
        return json.load(r)[0]


def mean_density(f107: float) -> list[float]:
    """Mean over latitudes −60…60° and 12 longitudes (= 12 local times) on an equinox day: a day/night global average."""
    lats, lons = np.arange(-60, 61, 30), np.arange(0, 360, 30)
    date = np.datetime64("2020-03-20T12:00")
    out = pymsis.calculate(date, lons, lats, ALTS, f107s=[f107], f107as=[f107], aps=[[15] * 7], version=2.1)
    rho = np.squeeze(out)[..., pymsis.Variable.MASS_DENSITY]  # (lon, lat, alt) kg/m3
    return [float(v) for v in rho.mean(axis=(0, 1))]


def fetch(url: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"}), timeout=120) as r:
        return r.read().decode("utf-8")


IGRF_URL = "https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt"
IGRF_A = 6371.2  # km, IGRF reference radius
SAA_ALT, SAA_EPOCH = 500.0, 2026.0


def igrf_field(lat: np.ndarray, lon: np.ndarray, r_km: float, g: dict, h: dict) -> np.ndarray:
    """Total intensity |B| (nT) on a geocentric lat/lon grid at radius r from Schmidt semi-normalised g, h (n<=13).
    B = -grad V with V = a sum (a/r)^(n+1) sum (g cos m phi + h sin m phi) P_n^m(cos theta); d/dtheta by central difference."""
    from scipy.special import lpmv

    def schmidt(n: int, m: int, x: np.ndarray) -> np.ndarray:
        p = lpmv(m, n, x) * (-1) ** m  # remove the Condon-Shortley phase
        return p if m == 0 else p * math.sqrt(2 * math.factorial(n - m) / math.factorial(n + m))

    th = np.radians(90 - lat)[:, None]
    ph = np.radians(lon)[None, :]
    d = 1e-4
    br = np.zeros((lat.size, lon.size)); bt = np.zeros_like(br); bp = np.zeros_like(br)
    for n in range(1, 14):
        k = (IGRF_A / r_km) ** (n + 2)
        for m in range(0, n + 1):
            gm, hm = g[(n, m)], h.get((n, m), 0.0)
            c, s = gm * np.cos(m * ph) + hm * np.sin(m * ph), -gm * m * np.sin(m * ph) + hm * m * np.cos(m * ph)
            P = schmidt(n, m, np.cos(th))
            dP = (schmidt(n, m, np.cos(th + d)) - schmidt(n, m, np.cos(th - d))) / (2 * d)
            br += (n + 1) * k * c * P
            bt += -k * c * dP
            bp += -k * s * P / np.sin(th)
    return np.sqrt(br**2 + bt**2 + bp**2)


def export_saa() -> None:
    lines = [l.split() for l in fetch(IGRF_URL).splitlines() if l[:2] in ("g ", "h ")]
    g, h = {}, {}
    for row in lines:
        v = float(row[-2]) + (SAA_EPOCH - 2025.0) * float(row[-1])  # 2025.0 model + secular variation
        (g if row[0] == "g" else h)[(int(row[1]), int(row[2]))] = v
    lat, lon = np.arange(-80, 81, 2.0), np.arange(-180, 180, 2.0)
    f = igrf_field(lat, lon, IGRF_A + SAA_ALT, g, h)
    f0 = igrf_field(lat, lon, IGRF_A, g, h)
    i, j = np.unravel_index(f.argmin(), f.shape)
    out = {"model": f"IGRF-14 ({IGRF_URL}), epoch {SAA_EPOCH}, geocentric radius 6371.2 + {SAA_ALT:.0f} km; total intensity |B| in nT",
           "alt_km": SAA_ALT, "lat": lat.tolist(), "lon": lon.tolist(), "nT": [[round(float(v)) for v in r] for r in f],
           "min": {"lat": float(lat[i]), "lon": float(lon[j]), "nT": round(float(f[i, j]))},
           "surface_min_nT": round(float(f0.min())), "surface_max_nT": round(float(f0.max())), "max_nT": round(float(f.max()))}
    (OUT / "igrf500.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print("IGRF |B| at 500 km: min", out["min"], "max", out["max_nT"], "; surface min/max", out["surface_min_nT"], out["surface_max_nT"])


SATCAT_URL = "https://celestrak.org/pub/satcat.csv"
ACTIVE = {"+", "P", "B", "S", "X"}  # CelesTrak operational status: operational, partially, backup, spare, extended


def export_satcat() -> None:
    rows = list(csv.DictReader(io.StringIO(fetch(SATCAT_URL))))
    on = [r for r in rows if not r["DECAY_DATE"] and r["ORBIT_CENTER"] == "EA" and r["DATA_STATUS_CODE"] != "NEA" and r["APOGEE"] and r["PERIGEE"]]
    edges = list(range(200, 2001, 20))
    cats = ["pay_active", "pay_inactive", "rb", "deb"]
    hist = {c: [0] * (len(edges) - 1) for c in cats}
    for r in on:
        mean = (float(r["APOGEE"]) + float(r["PERIGEE"])) / 2
        if not edges[0] <= mean < edges[-1]:
            continue
        t = r["OBJECT_TYPE"]
        c = ("pay_active" if r["OPS_STATUS_CODE"] in ACTIVE else "pay_inactive") if t == "PAY" else "rb" if t == "R/B" else "deb"  # UNK counted as debris
        hist[c][(int(mean) - edges[0]) // 20] += 1
    total = {c: sum(v) for c, v in hist.items()}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = {"retrieved": now, "source": SATCAT_URL, "note": "on-orbit objects with elements; mean altitude (apogee+perigee)/2; 20 km bins; UNK counted as debris",
           "on_orbit_total": len(on), "edges_km": edges, "hist": hist, "in_range_total": total}
    (OUT / "debris.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print("SATCAT", now, "on orbit with elements", len(on), "in 200-2000 km", total)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    parts = set(sys.argv[1:]) or {"gp", "density", "saa", "satcat"}
    if "saa" in parts:
        export_saa()
    if "satcat" in parts:
        export_satcat()
    if not parts & {"gp", "density"}:
        return
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    sats = [gp(n) for n in SATS]
    (OUT / "sats.json").write_text(json.dumps({"retrieved": now, "source": "CelesTrak GP (gp.php?CATNR=…)", "gp": sats}, indent=1), encoding="utf-8")
    dens = {k: mean_density(v) for k, v in ACTIVITY.items()}
    (OUT / "density.json").write_text(json.dumps({
        "model": f"NRLMSIS 2.1 via pymsis {pymsis.__version__}; mean of lat -60..60 step 30, 12 longitudes, 2020-03-20 12 UT; Ap 15",
        "f107": ACTIVITY, "alt_km": [int(a) for a in ALTS], "rho_kg_m3": dens}, indent=1), encoding="utf-8")
    for s in sats:
        print(s["OBJECT_NAME"], s["EPOCH"], "rev/day", s["MEAN_MOTION"], "inc", s["INCLINATION"])
    for a in (300, 400, 500, 600, 700, 800):
        i = int((a - 100) / 10)
        print(f"{a} km rho low {dens['low'][i]:.3e} high {dens['high'][i]:.3e} ratio {dens['high'][i] / dens['low'][i]:.1f}")


if __name__ == "__main__":
    main()
