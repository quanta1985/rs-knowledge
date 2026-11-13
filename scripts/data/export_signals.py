"""Chapter 5 (signals) data: VINASAT GP elements from CelesTrak and ITU-R rain-attenuation tables for Vietnamese stations.

Usage:
    python -m pip install itur        # ITU-Rpy 0.4: ITU-R P.618-13, P.837-7, P.838-3, P.839-4 with their digital maps
    python -I scripts/data/export_signals.py
Output: public/data/signals/signals.json
The EO satellites for the ground-station passes come from public/data/ch01-missions.json (same CelesTrak snapshot day).
"""
import json
import math
import sys
import urllib.request
import warnings
from datetime import datetime, timezone
from pathlib import Path

import itur.models.itu618 as p618
import itur.models.itu837 as p837
import itur.models.itu838 as p838
import itur.models.itu839 as p839

ROOT = Path(__file__).resolve().parents[2]
GEO = {32767: "VINASAT-1", 38332: "VINASAT-2"}
STATIONS = {"hn": ("Hà Nội", 21.03, 105.85), "hcm": ("TP.HCM", 10.78, 106.70), "svalbard": ("Svalbard", 78.23, 15.39)}
FREQS = [1, 1.5, 2, 2.2, 3, 4, 5, 6, 7, 8, 8.1, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35, 40]
PS = [0.01, 0.1, 1.0]  # % of an average year the attenuation is exceeded
ELS = [10, 20, 30, 45, 60, 90]
RE, RGEO = 6378.137, 42164.0


def geo_elevation(lat: float, lon: float, sat_lon: float) -> float:
    """Elevation (deg) of a GEO satellite at sat_lon seen from (lat, lon), spherical Earth."""
    c = math.cos(math.radians(lat)) * math.cos(math.radians(sat_lon - lon))
    return math.degrees(math.atan2(c - RE / RGEO, math.sqrt(1 - c * c)))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    warnings.filterwarnings("ignore")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    geo = []
    for norad, name in GEO.items():
        url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=json"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "rs-knowledge-handbook"}), timeout=60) as r:
            d = json.load(r)[0]
        geo.append({"name": name, "norad": norad, "epoch": d["EPOCH"], "n": d["MEAN_MOTION"], "e": d["ECCENTRICITY"], "i": d["INCLINATION"],
                    "raan": d["RA_OF_ASC_NODE"], "argp": d["ARG_OF_PERICENTER"], "M": d["MEAN_ANOMALY"]})
        print(name, d["EPOCH"])

    kk = [float(p838.rain_specific_attenuation_coefficients(f, 45, 45)[0]) for f in FREQS]  # circular polarisation (tau = 45°)
    aa = [float(p838.rain_specific_attenuation_coefficients(f, 45, 45)[1]) for f in FREQS]
    stations = {}
    for key, (name, lat, lon) in STATIONS.items():
        r001 = float(p837.rainfall_rate(lat, lon, 0.01).value)
        hr = float(p839.rain_height(lat, lon).value)
        el_v1 = geo_elevation(lat, lon, 132.0)
        sees_geo = el_v1 >= 5  # Svalbard (78°N) is below the horizon of 132°E
        els = ELS + ([round(el_v1, 1)] if sees_geo else [])
        att = {str(p): {str(el): [round(float(p618.rain_attenuation(lat, lon, f, el, p=p, tau=45).value), 3) for f in FREQS] for el in els} for p in PS}
        stations[key] = {"name": name, "lat": lat, "lon": lon, "R001": round(r001, 1), "rainHeightKm": round(hr, 2),
                         "elVinasat132E": round(el_v1, 1) if sees_geo else None, "A": att}
        el_key = str(round(el_v1, 1)) if sees_geo else "45"
        print(f"{name}: R0.01 {r001:.1f} mm/h, rain height {hr:.2f} km, el to 132°E {el_v1:.1f}°, "
              f"A0.01 at {el_key}°: Ku12 {att['0.01'][el_key][FREQS.index(12)]} dB, Ka20 {att['0.01'][el_key][FREQS.index(20)]} dB")

    out = ROOT / "public/data/signals/signals.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "geo": geo,
        "freqsGHz": FREQS, "ps": PS, "els": ELS,
        "p838": {"k": [round(x, 6) for x in kk], "alpha": [round(x, 4) for x in aa], "polarisation": "circular (tau = 45°)"},
        "stations": stations,
        "provenance": {"geo": "CelesTrak GP data (OMM JSON), https://celestrak.org", "retrieved": now,
                       "rain": "ITU-R P.618-13 (slant-path rain attenuation), P.837-7 (rain rate R0.01), P.838-3 (k, α), P.839-4 (rain height), "
                               "computed with ITU-Rpy 0.4 (https://github.com/inigodelportillo/ITU-Rpy)",
                       "script": "scripts/data/export_signals.py"},
    }, ensure_ascii=False, allow_nan=False), "utf-8")
    print("->", out)


if __name__ == "__main__":
    main()
