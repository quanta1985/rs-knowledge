"""Generate labs/gnss_positioning.ipynb (Colab).

    cd scripts && python build_lab_gnss.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 7 — GNSS: vệ tinh nhìn thấy, DOP và tự giải vị trí / GNSS: visible satellites, DOP and solving a position

**Sổ tay Viễn thám & GIS — Chương 7** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/gnss/)

1. Tải phần tử quỹ đạo GPS, Galileo, GLONASS, BeiDou (CelesTrak) / Load the orbital elements.
2. Truyền quỹ đạo bằng SGP4, tính góc cao và phương vị từ Hà Nội / Propagate with SGP4, look angles from Hanoi.
3. Sky plot và DOP trong 24 giờ / Sky plot and DOP over 24 hours.
4. Tự viết bộ giải bình phương nhỏ nhất (x, y, z, c·δt) / Write a least-squares solver (x, y, z, c·δt)."""),
    (PY, """try:
    import sgp4
except ImportError:   # Colab: cài thư viện SGP4 / install the SGP4 library
    import subprocess, sys
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'sgp4'], check=True)"""),
    (PY, """import json, math, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from sgp4.api import Satrec, jday
from sgp4 import omm

# Ảnh chụp của chương (cùng số liệu với các hình) / the chapter's snapshot (same data as the figures)
URL = 'https://raw.githubusercontent.com/quanta1985/rs-knowledge/main/public/data/gnss/constellations.json'
local = Path('../public/data/gnss/constellations.json')
if local.exists():
    snap = json.loads(local.read_text('utf-8'))
else:
    snap = json.load(urllib.request.urlopen(URL, timeout=60))
T0 = datetime.fromisoformat(snap['t0'].replace('Z', '+00:00'))
print('Mốc thời gian / reference time:', T0, '·', len(snap['sats']), 'vật thể / objects')
# Muốn số liệu mới nhất: tải trực tiếp từ CelesTrak (nhóm gps-ops, galileo, glo-ops, beidou)
# For fresh data fetch https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json etc."""),
    (MD, "## 1. SGP4 và hệ tọa độ Trái Đất / SGP4 and Earth-fixed coordinates"),
    (PY, """def satrec(row):
    system, name, norad, epoch, n, e, i, raan, argp, M = row
    f = dict(OBJECT_NAME=name, OBJECT_ID='X', EPOCH=epoch, MEAN_MOTION=str(n), ECCENTRICITY=str(e), INCLINATION=str(i),
             RA_OF_ASC_NODE=str(raan), ARG_OF_PERICENTER=str(argp), MEAN_ANOMALY=str(M), EPHEMERIS_TYPE='0',
             CLASSIFICATION_TYPE='U', NORAD_CAT_ID=str(norad), ELEMENT_SET_NO='999', REV_AT_EPOCH='0',
             BSTAR='0', MEAN_MOTION_DOT='0', MEAN_MOTION_DDOT='0')   # MEO: không có lực cản / no drag
    s = Satrec(); omm.initialize(s, f); return system, name, s

SATS = [satrec(r) for r in snap['sats']]
RE, F = 6378.137, 1 / 298.257223563
E2 = F * (2 - F)

def ecef(s, t):
    jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second)
    err, r, _ = s.sgp4(jd, fr)
    g = math.radians((280.46061837 + 360.98564736629 * (jd + fr - 2451545.0)) % 360)   # GMST (TEME → ECEF, bỏ qua chuyển động cực)
    return np.array([r[0] * math.cos(g) + r[1] * math.sin(g), -r[0] * math.sin(g) + r[1] * math.cos(g), r[2]])

def geodetic_to_ecef(lat, lon, h=0.0):
    la, lo = math.radians(lat), math.radians(lon)
    N = RE / math.sqrt(1 - E2 * math.sin(la) ** 2)
    return np.array([(N + h) * math.cos(la) * math.cos(lo), (N + h) * math.cos(la) * math.sin(lo), (N * (1 - E2) + h) * math.sin(la)])

def enu_matrix(lat, lon):
    la, lo = math.radians(lat), math.radians(lon)
    return np.array([[-math.sin(lo), math.cos(lo), 0],
                     [-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)],
                     [math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)]])

HANOI = (21.03, 105.85)
R_HN, M_HN = geodetic_to_ecef(*HANOI), enu_matrix(*HANOI)

def looks(t, lat_lon=HANOI):
    rx, M = geodetic_to_ecef(*lat_lon), enu_matrix(*lat_lon)
    out = []
    for system, name, s in SATS:
        e, n, u = M @ (ecef(s, t) - rx)
        rng = math.sqrt(e * e + n * n + u * u)
        out.append((system, name, math.degrees(math.atan2(e, n)) % 360, math.degrees(math.asin(u / rng)), rng))
    return out

L = looks(T0)
for sysname in ['GPS', 'Galileo', 'GLONASS', 'BeiDou']:
    print(f"{sysname:8s} trên 10° / above 10°: {sum(1 for l in L if l[0] == sysname and l[3] >= 10)}")"""),
    (MD, "## 2. Sky plot và DOP / Sky plot and DOP"),
    (PY, """COL = {'GPS': '#0072B2', 'Galileo': '#E69F00', 'GLONASS': '#CC79A7', 'BeiDou': '#009E73'}
MK = {'GPS': 'o', 'Galileo': 's', 'GLONASS': '^', 'BeiDou': 'D'}

def dop(lk, mask=10):
    v = [l for l in lk if l[3] >= mask]
    if len(v) < 4: return None
    H = np.array([[-math.cos(math.radians(el)) * math.sin(math.radians(az)), -math.cos(math.radians(el)) * math.cos(math.radians(az)),
                   -math.sin(math.radians(el)), 1] for _, _, az, el, _ in v])
    Q = np.linalg.inv(H.T @ H)
    return dict(GDOP=np.sqrt(np.trace(Q)), PDOP=np.sqrt(Q[0, 0] + Q[1, 1] + Q[2, 2]), HDOP=np.sqrt(Q[0, 0] + Q[1, 1]),
                VDOP=np.sqrt(Q[2, 2]), TDOP=np.sqrt(Q[3, 3]))

print('GPS  :', {k: round(float(v), 2) for k, v in dop([l for l in L if l[0] == 'GPS']).items()})
print('4 hệ :', {k: round(float(v), 2) for k, v in dop(L).items()})

ax = plt.subplot(projection='polar'); ax.set_theta_zero_location('N'); ax.set_theta_direction(-1)
for sysname in COL:
    pts = [(math.radians(az), 90 - el) for s_, _, az, el, _ in L if s_ == sysname and el >= 0]
    ax.scatter(*zip(*pts), c=COL[sysname], marker=MK[sysname], label=sysname, s=30)
ax.set_rlim(0, 90); ax.set_rticks([30, 60, 80]); ax.set_yticklabels(['60°', '30°', '10°'])
ax.legend(loc='lower left', bbox_to_anchor=(1.05, 0)); ax.set_title('Hà Nội, ' + T0.strftime('%Y-%m-%d %H:%M UTC')); plt.show()"""),
    (PY, """# PDOP trong 24 giờ, góc che 10° / PDOP over 24 h, 10° mask
ts = [T0 + timedelta(minutes=15 * k) for k in range(96)]
pd_gps, pd_all = [], []
for t in ts:
    lk = looks(t)
    pd_gps.append(dop([l for l in lk if l[0] == 'GPS'])['PDOP'])
    pd_all.append(dop(lk)['PDOP'])
h = [(t - T0).total_seconds() / 3600 for t in ts]
plt.figure(figsize=(8, 3)); plt.plot(h, pd_gps, label='GPS'); plt.plot(h, pd_all, '--', label='4 hệ / all 4')
plt.xlabel('Giờ kể từ mốc / hours from t0'); plt.ylabel('PDOP'); plt.legend(); plt.grid(alpha=.3); plt.show()
print('PDOP trung vị / median: GPS', round(float(np.median(pd_gps)), 2), '· 4 hệ / all', round(float(np.median(pd_all)), 2))"""),
    (MD, """## 3. Tự giải vị trí / Solve a position yourself

Mô phỏng khoảng cách giả từ vị trí thật ở Hồ Hoàn Kiếm, đồng hồ máy thu lệch 100 µs (≈ 30 km!) và nhiễu 3 m, rồi giải bằng Gauss–Newton.
Simulate pseudoranges from a true position at Hoan Kiem Lake, a 100 µs receiver clock error (≈ 30 km!) and 3 m noise, then solve by Gauss–Newton."""),
    (PY, """C = 299792.458   # km/s
rng = np.random.default_rng(7)
truth = geodetic_to_ecef(21.0285, 105.8522, 0.01)
gps_vis = [s for (sy, _, s), l in zip(SATS, L) if sy == 'GPS' and l[3] >= 10]
P = np.array([ecef(s, T0) for s in gps_vis])
b_true = C * 100e-6                                        # km
rho = np.linalg.norm(P - truth, axis=1) + b_true + rng.normal(0, 0.003, len(P))

x = np.zeros(4)                                            # bắt đầu ở tâm Trái Đất / start at the Earth's centre
for it in range(8):
    d = np.linalg.norm(P - x[:3], axis=1)
    H = np.hstack([-(P - x[:3]) / d[:, None], np.ones((len(P), 1))])
    dx = np.linalg.lstsq(H, rho - (d + x[3]), rcond=None)[0]
    x += dx
    print(f'vòng / iter {it + 1}: sai số vị trí / position error {np.linalg.norm(x[:3] - truth) * 1000:12.1f} m, δt = {x[3] / C * 1e6:8.3f} µs')
    if np.linalg.norm(dx) < 1e-7: break"""),
    (MD, """## Bài tập / Exercises

1. Bỏ cột đồng hồ (chỉ giải x, y, z): sai số còn bao nhiêu? / Drop the clock column: how large is the error?
2. Chỉ giữ 4 vệ tinh có góc cao lớn nhất rồi 4 vệ tinh thấp nhất; so PDOP và sai số. / Keep the 4 highest, then the 4 lowest satellites; compare PDOP and error.
3. Thêm Galileo vào bộ giải (cần thêm một ẩn độ lệch thời gian Galileo–GPS). / Add Galileo (needs an extra Galileo–GPS time-offset unknown).

*Orbital elements: CelesTrak (https://celestrak.org).*"""),
]

if __name__ == "__main__":
    main(CELLS, "gnss_positioning")
