"""Generate labs/signals_linkbudget.ipynb (Colab).

    cd scripts && python build_lab_signals.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 5 — Ngân sách đường truyền, mưa nhiệt đới và lượt bay qua trạm / Link budgets, tropical rain and ground-station passes

**Sổ tay Viễn thám & GIS — Chương 5** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/signals/)

1. Decibel, suy hao không gian tự do, độ lợi chảo / Decibels, free-space loss, dish gain.
2. Ngân sách đường truyền của ba kịch bản trong Hình 5.1 / The link budgets of the three scenarios of Figure 5.1.
3. Suy hao mưa ITU-R P.618 cho Hà Nội và TP.HCM bằng ITU-Rpy / ITU-R P.618 rain attenuation for Hanoi and HCMC with ITU-Rpy.
4. Lượt bay qua Hà Nội và Svalbard của Sentinel-2A bằng SGP4 / Sentinel-2A passes over Hanoi and Svalbard with SGP4."""),
    (PY, """import importlib, subprocess, sys
for pkg in ['sgp4', 'itur']:   # Colab: cài thư viện còn thiếu / install what is missing
    try:
        importlib.import_module(pkg)
    except ImportError:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', pkg], check=True)"""),
    (PY, """import json, math, urllib.request, warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
warnings.filterwarnings('ignore')

def load(rel):   # số liệu của chương (cùng với các hình) / the chapter's data (same as the figures)
    local = Path('..') / rel
    if local.exists():
        return json.loads(local.read_text('utf-8'))
    return json.load(urllib.request.urlopen('https://raw.githubusercontent.com/quanta1985/rs-knowledge/main/' + rel, timeout=60))

EO = load('public/data/ch01-missions.json')
SIG = load('public/data/signals/signals.json')
print('Phần tử quỹ đạo tải lúc / elements retrieved:', EO['provenance']['retrieved'])"""),
    (MD, "## 1. Decibel, FSPL, độ lợi chảo / Decibels, FSPL, dish gain"),
    (PY, """C = 299_792_458.0          # m/s
K_DB = 10 * math.log10(1.380649e-23)   # −228,6 dBW/(K·Hz)
RE = 6378.137

db = lambda x: 10 * math.log10(x)
fspl = lambda f_hz, d_km: 20 * math.log10(4 * math.pi * d_km * 1e3 * f_hz / C)
dish = lambda d_m, f_hz, eff=0.6: db(eff * (math.pi * d_m * f_hz / C) ** 2)
slant = lambda h_km, el: math.sqrt((RE + h_km) ** 2 - (RE * math.cos(math.radians(el))) ** 2) - RE * math.sin(math.radians(el))

print(f'FSPL GEO 35 786 km @ 12 GHz: {fspl(12e9, 35786):.1f} dB')
print(f'FSPL Sentinel-2 786 km @ 8,1 GHz: thiên đỉnh / zenith {fspl(8.1e9, 786):.1f} dB, 5° ({slant(786, 5):.0f} km) {fspl(8.1e9, slant(786, 5)):.1f} dB')
for d, f in [(0.6, 12e9), (1.2, 12e9), (5.4, 8.1e9), (13, 8.1e9)]:
    print(f'chảo / dish {d} m @ {f / 1e9} GHz: {dish(d, f):.1f} dBi')"""),
    (MD, "## 2. Ngân sách đường truyền / Link budget"),
    (PY, """def link(f_hz, alt_km, el, pt_w, gt_dbi, rx_d_m, tsys_k, rate_bps, req_db, rain_db=0.0, other_db=0.0, eff=0.6):
    d = slant(alt_km, el)
    eirp = db(pt_w) + gt_dbi
    gt = dish(rx_d_m, f_hz, eff) - db(tsys_k)
    cn0 = eirp - fspl(f_hz, d) - rain_db - other_db + gt - K_DB
    ebn0 = cn0 - db(rate_bps)
    return dict(d_km=round(d), EIRP=round(eirp, 1), FSPL=round(fspl(f_hz, d), 1), GT=round(gt, 1), CN0=round(cn0, 1),
                EbN0=round(ebn0, 1), margin=round(ebn0 - req_db, 1), max_rate_Mbps=round(10 ** ((cn0 - req_db) / 10) / 1e6, 1),
                shannon_Mbps=round(10 ** (cn0 / 10) / math.log(2) / 1e6))

# Ba kịch bản minh họa của Hình 5.1 (không phải thông số công bố của vệ tinh nào) / the three illustrative scenarios of Figure 5.1
print('LEO X :', link(8.1e9, 786, 10, 10, 6, 5.4, 200, 560e6, 2.3, other_db=3))
print('LEO S :', link(2.2e9, 786, 5, 2, 0, 5.4, 250, 64e3, 9.6, other_db=3))
print('GEO Ku:', link(12e9, 35786, 51.5, 100, 32, 0.6, 120, 40e6, 2.3, other_db=1.5, eff=0.65))"""),
    (MD, """## 3. Mưa nhiệt đới (ITU-R P.618) / Tropical rain (ITU-R P.618)

ITU-Rpy chứa bản đồ số của ITU-R P.837 (cường độ mưa), P.839 (độ cao lớp mưa) và hệ số P.838. / ITU-Rpy ships the digital maps of P.837 and P.839 and the P.838 coefficients."""),
    (PY, """import itur.models.itu618 as p618, itur.models.itu837 as p837

def geo_el(lat, lon, sat_lon, rgeo=42164.0):
    c = math.cos(math.radians(lat)) * math.cos(math.radians(sat_lon - lon))
    return math.degrees(math.atan2(c - RE / rgeo, math.sqrt(1 - c * c)))

for name, lat, lon in [('Hà Nội', 21.03, 105.85), ('TP.HCM', 10.78, 106.70)]:
    el = geo_el(lat, lon, 132.0)
    r = float(p837.rainfall_rate(lat, lon, 0.01).value)
    row = {f: [round(float(p618.rain_attenuation(lat, lon, f, el, p=p, tau=45).value), 1) for p in (1, 0.1, 0.01)] for f in (4, 12, 20, 30)}
    print(f'{name}: R0,01 = {r:.1f} mm/h, góc ngẩng tới 132°E / elevation {el:.1f}°; suy hao [1 %, 0,1 %, 0,01 %] dB:', row)

fs = np.arange(2, 41, 1.0)
for p, ls in [(1, ':'), (0.1, '--'), (0.01, '-')]:
    plt.plot(fs, [float(p618.rain_attenuation(21.03, 105.85, f, 51.5, p=p, tau=45).value) for f in fs], ls, label=f'{p} %')
plt.xlabel('Tần số / frequency (GHz)'); plt.ylabel('Suy hao / attenuation (dB)'); plt.title('Hà Nội → VINASAT-1 (51,5°)')
plt.legend(); plt.grid(alpha=.3); plt.show()"""),
    (MD, "## 4. Lượt bay qua bằng SGP4 / Passes with SGP4"),
    (PY, """from sgp4.api import Satrec, jday
from sgp4 import omm

def satrec(o):
    f = {k: str(o[k]) for k in ['OBJECT_NAME', 'OBJECT_ID', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE',
                                'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'NORAD_CAT_ID']}
    f.update(EPHEMERIS_TYPE='0', CLASSIFICATION_TYPE='U', ELEMENT_SET_NO='999', REV_AT_EPOCH='0', BSTAR='0', MEAN_MOTION_DOT='0', MEAN_MOTION_DDOT='0')
    s = Satrec(); omm.initialize(s, f); return s   # BSTAR = 0: bỏ lực cản trong 1 ngày / no drag over one day

F = 1 / 298.257223563; E2 = F * (2 - F)
def site_ecef(lat, lon):
    la, lo = math.radians(lat), math.radians(lon); N = RE / math.sqrt(1 - E2 * math.sin(la) ** 2)
    return np.array([N * math.cos(la) * math.cos(lo), N * math.cos(la) * math.sin(lo), N * (1 - E2) * math.sin(la)])

def elevation(s, t, lat, lon):
    jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second + t.microsecond / 1e6)
    _, r, _ = s.sgp4(jd, fr)
    g = math.radians((280.46061837 + 360.98564736629 * (jd + fr - 2451545.0)) % 360)
    p = np.array([r[0] * math.cos(g) + r[1] * math.sin(g), -r[0] * math.sin(g) + r[1] * math.cos(g), r[2]])
    rx = site_ecef(lat, lon); up = rx / np.linalg.norm(rx); d = p - rx
    return math.degrees(math.asin(d @ up / np.linalg.norm(d)))

def passes(s, lat, lon, mask=5, t0=datetime(2026, 11, 4, tzinfo=timezone.utc), step=20):
    out, start = [], None
    for k in range(0, 86400 // step + 1):
        t = t0 + timedelta(seconds=k * step); el = elevation(s, t, lat, lon)
        if el >= mask and start is None: start = t
        if el < mask and start is not None: out.append((start, t)); start = None
    return out

s2a = satrec(next(o for o in EO['satellites'] if o['name'] == 'Sentinel-2A'))
for name, lat, lon in [('Hà Nội', 21.03, 105.85), ('Svalbard', 78.23, 15.39)]:
    ps = passes(s2a, lat, lon)
    mins = sum((b - a).total_seconds() for a, b in ps) / 60
    print(f'{name}: {len(ps)} lượt / passes, tổng / total {mins:.1f} phút / min, '
          f'≈ {mins * 60 * 560e6 / 8e9:.0f} GB @ 560 Mbit/s;', [a.strftime('%H:%M') for a, _ in ps])"""),
    (MD, """## Bài tập / Exercises

1. Thiết kế đường truyền cho một CubeSat ở 500 km (băng S, 2 W, anten 3 dBi, chảo trạm 3 m): ở góc ngẩng 10°, tốc độ tối đa với QPSK không mã (9,6 dB) là bao nhiêu? Ở 5°? / Design a 500 km CubeSat link and find the highest QPSK rate at 10° and 5°.
2. Hàm `passes` của notebook (SGP4) có cho cùng số lượt và số phút như Hình 5.3 (Kepler + J2) không? Chênh bao nhiêu? / Does SGP4 give the same passes and minutes as Figure 5.3 (Kepler + J2)?
3. Tìm tần số cao nhất để tuyến Hà Nội → 132°E vẫn chỉ mất dưới 3 dB trong 99,9 % thời gian. / Find the highest frequency for which the Hanoi → 132°E path loses less than 3 dB 99.9 % of the time.

*Orbital elements: CelesTrak (https://celestrak.org). Rain: ITU-R P.618-13, P.837-7, P.838-3, P.839-4 via ITU-Rpy.*"""),
]

if __name__ == "__main__":
    main(CELLS, "signals_linkbudget")
