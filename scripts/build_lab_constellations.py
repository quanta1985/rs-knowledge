"""Generate labs/constellations_walker.ipynb (Colab).

    cd scripts && python build_lab_constellations.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 6 — Chòm sao LEO: Starlink nhìn từ Hà Nội và tự thiết kế chòm sao Walker / LEO constellations: Starlink from Hanoi and designing a Walker constellation

**Sổ tay Viễn thám & GIS — Chương 6** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/constellations/)

1. Tải ảnh chụp phần tử quỹ đạo Starlink, OneWeb, Kuiper (CelesTrak) và tìm các lớp quỹ đạo / Load the snapshot and find the shells.
2. Truyền quỹ đạo bằng SGP4, đếm vệ tinh Starlink trên bầu trời Hà Nội / Propagate with SGP4, count Starlink satellites above Hanoi.
3. Tự viết chòm sao Walker T/P/F và tính độ phủ một điểm trong 24 giờ / Write a Walker T/P/F pattern and its 24-hour point coverage.
4. Số vệ tinh cần để phủ liên tục theo độ cao / Satellites needed for continuous coverage versus altitude."""),
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
from sgp4.api import Satrec, SatrecArray, WGS72, jday

# Ảnh chụp của chương (cùng số liệu với các hình) / the chapter's snapshot (same data as the figures)
URL = 'https://raw.githubusercontent.com/quanta1985/rs-knowledge/main/public/data/constellations/leo.json'
local = Path('../public/data/constellations/leo.json')
snap = json.loads(local.read_text('utf-8')) if local.exists() else json.load(urllib.request.urlopen(URL, timeout=120))
T0 = datetime.fromisoformat(snap['t0'].replace('Z', '+00:00'))
print('Mốc thời gian / reference time:', T0, {k: len(v) for k, v in snap['sats'].items()})
# Số liệu mới nhất / fresh data: https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json"""),
    (MD, "## 1. Các lớp quỹ đạo / Orbital shells"),
    (PY, """MU, RE = 398600.4418, 6378.137
def altitude(n_rev_day):
    n = n_rev_day * 2 * math.pi / 86400
    return (MU / n ** 2) ** (1 / 3) - RE

plt.figure(figsize=(8, 4))
for fleet, col in [('Starlink', '#0072B2'), ('OneWeb', '#E69F00'), ('Kuiper', '#D55E00')]:
    rows = snap['sats'].get(fleet, [])
    plt.scatter([r[4] for r in rows], [altitude(r[2]) for r in rows], s=3, c=col, label=f'{fleet} ({len(rows)})')
plt.xlabel('Độ nghiêng / inclination (°)'); plt.ylabel('Độ cao / altitude (km)'); plt.ylim(250, 1300)
plt.legend(markerscale=4); plt.grid(alpha=.3); plt.title('CelesTrak ' + snap['t0']); plt.show()
st = np.array([[r[4], altitude(r[2])] for r in snap['sats']['Starlink']])
for inc in (43, 53, 70, 97):
    m = (np.floor(st[:, 0] + 0.3) == inc) & (st[:, 1] >= 400)
    print(f'Starlink {inc}°: {m.sum():5d} vệ tinh / satellites, độ cao trung vị / median altitude {np.median(st[m, 1]):.0f} km')
print('Dưới 400 km (đang nâng/hạ quỹ đạo) / below 400 km (raising/lowering):', int((st[:, 1] < 400).sum()))"""),
    (MD, """## 2. Starlink trên bầu trời Hà Nội / Starlink above Hanoi

SGP4 cần thêm hệ số cản BSTAR; ảnh chụp gọn của chương không lưu nó nên đặt bằng 0. Trong vài giờ quanh mốc thời gian sai số nhỏ.
SGP4 also wants the drag term BSTAR; the compact snapshot drops it, so it is set to 0. Errors stay small within a few hours of the epoch."""),
    (PY, """def satrec(row):
    norad, epoch_min, n, e, i, raan, argp, M = row
    ep = T0 + timedelta(minutes=epoch_min)
    jd, fr = jday(ep.year, ep.month, ep.day, ep.hour, ep.minute, ep.second + ep.microsecond / 1e6)
    s = Satrec()
    s.sgp4init(WGS72, 'i', int(norad), (jd + fr) - 2433281.5, 0.0, 0.0, 0.0, e, math.radians(argp), math.radians(i),
               math.radians(M), n * 2 * math.pi / 1440, math.radians(raan))
    return s

STAR = SatrecArray([satrec(r) for r in snap['sats']['Starlink']])
HANOI = (21.03, 105.85)

def ecef_all(arr, t):
    jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second)
    err, r, _ = arr.sgp4(np.array([jd]), np.array([fr]))
    r = r[:, 0, :]
    g = math.radians((280.46061837 + 360.98564736629 * (jd + fr - 2451545.0)) % 360)   # GMST: TEME → ECEF (bỏ qua chuyển động cực)
    return np.c_[r[:, 0] * math.cos(g) + r[:, 1] * math.sin(g), -r[:, 0] * math.sin(g) + r[:, 1] * math.cos(g), r[:, 2]], err[:, 0]

def elevations(P, lat, lon):
    la, lo = math.radians(lat), math.radians(lon)
    f = 1 / 298.257223563; e2 = f * (2 - f); N = RE / math.sqrt(1 - e2 * math.sin(la) ** 2)
    rx = np.array([N * math.cos(la) * math.cos(lo), N * math.cos(la) * math.sin(lo), N * (1 - e2) * math.sin(la)])
    up = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    d = P - rx; rng = np.linalg.norm(d, axis=1)
    return np.degrees(np.arcsin(d @ up / rng)), rng

P, err = ecef_all(STAR, T0)
el, rng = elevations(P, *HANOI)
ok = err == 0
for mask in (10, 25, 40):
    print(f'Góc ngẩng ≥ {mask}° / elevation ≥ {mask}°: {int(((el >= mask) & ok).sum())} vệ tinh / satellites')
near = rng[(el >= 25) & ok].min()
print(f'Gần nhất / nearest: {near:.0f} km → trễ một chiều / one-way delay {near / 299792.458 * 1000:.2f} ms')"""),
    (PY, """# Trong 24 giờ, mỗi 10 phút / over 24 h, every 10 minutes
ts = [T0 + timedelta(minutes=10 * k) for k in range(144)]
counts = []
for t in ts:
    P, err = ecef_all(STAR, t)
    el, _ = elevations(P, *HANOI)
    counts.append(int(((el >= 25) & (err == 0)).sum()))
h = [(t - T0).total_seconds() / 3600 for t in ts]
plt.figure(figsize=(8, 3)); plt.step(h, counts, where='post'); plt.ylim(0, None)
plt.xlabel('Giờ kể từ mốc / hours from t0'); plt.ylabel('Starlink ≥ 25°'); plt.grid(alpha=.3); plt.show()
print('Trung bình / mean', round(float(np.mean(counts)), 1), '· ít nhất / min', min(counts), '· nhiều nhất / max', max(counts))"""),
    (MD, """## 3. Chòm sao Walker T/P/F / A Walker T/P/F constellation

P mặt phẳng cách đều nhau (360°/P với dạng delta, 180°/P với dạng star quỹ đạo cực), mỗi mặt phẳng T/P vệ tinh, mặt phẳng kề lệch pha F·360°/T.
Một vệ tinh thấy điểm trên mặt đất khi góc ở tâm Trái Đất giữa hai điểm ≤ λ, với λ tính từ độ cao và góc ngẩng tối thiểu.

P equally spaced planes (360°/P for a delta, 180°/P for a polar star pattern), T/P satellites per plane, phase offset F·360°/T between neighbouring planes.
A satellite sees a ground point when the Earth central angle between them is ≤ λ, with λ from the altitude and the minimum elevation."""),
    (PY, """OMEGA_E = 7.2921159e-5

def half_angle(h, mask):   # λ (rad)
    return math.acos(RE * math.cos(math.radians(mask)) / (RE + h)) - math.radians(mask)

def coverage(T, P, F, h, inc, mask, lat, lon=0.0, hours=24, step=60, spread=360):
    S = T // P
    raan = np.repeat(np.radians(spread / P * np.arange(P)), S)
    u0 = np.radians(np.tile(360 / S * np.arange(S), P) + np.repeat(F * 360 * np.arange(P) / T, S))
    i, n = math.radians(inc), math.sqrt(MU / (RE + h) ** 3)
    g = np.array([math.cos(math.radians(lat)) * math.cos(math.radians(lon)), math.cos(math.radians(lat)) * math.sin(math.radians(lon)), math.sin(math.radians(lat))])
    t = np.arange(0, hours * 3600, step)[:, None]
    u, O = u0 + n * t, raan - OMEGA_E * t
    x = np.cos(O) * np.cos(u) - np.sin(O) * math.cos(i) * np.sin(u)
    y = np.sin(O) * np.cos(u) + np.cos(O) * math.cos(i) * np.sin(u)
    z = math.sin(i) * np.sin(u)
    in_view = ((x * g[0] + y * g[1] + z * g[2]) >= math.cos(half_angle(h, mask))).sum(axis=1)
    return in_view

for name, args in [('36 LEO 6/6/1, 550 km, 53°, 25°', (36, 6, 1, 550, 53, 25)),
                   ('Kiểu Iridium / Iridium-like 66/6/2 star', (66, 6, 2, 780, 86.4, 8.2)),
                   ('Kiểu GPS / GPS-like 24/6/1', (24, 6, 1, 20180, 55, 10))]:
    v = coverage(*args, *HANOI, spread=180 if 'star' in name else 360)
    print(f'{name:42s} phủ / covered {100 * (v > 0).mean():5.1f} %, TB nhìn thấy / mean in view {v.mean():.1f}')"""),
    (MD, "## 4. Cần bao nhiêu vệ tinh? / How many satellites?"),
    (PY, """def area_bound(h, mask):
    return 2 / (1 - math.cos(half_angle(h, mask)))

def polar_streets(h, mask):   # Adams & Rider (1987): (P − 1)(c + λ) + 2c ≥ π
    lam, best = half_angle(h, mask), None
    for S in range(int(math.pi / lam) + 1, int(math.pi / lam) + 40):
        c = math.acos(math.cos(lam) / math.cos(math.pi / S))
        P = math.ceil((math.pi - 2 * c) / (c + lam) + 1)
        if best is None or S * P < best[2]: best = (S, P, S * P)
    return best

print('Iridium (780 km, 8,2°):', polar_streets(780, 8.2))
hs = np.geomspace(300, 36000, 80)
plt.figure(figsize=(7, 4))
for mask, ls in [(25, '-'), (10, '--')]:
    plt.loglog(hs, [polar_streets(h, mask)[2] for h in hs], ls, c='#0072B2', label=f'quỹ đạo cực / polar, {mask}°')
    plt.loglog(hs, [area_bound(h, mask) for h in hs], ls, c='#E69F00', label=f'cận dưới diện tích / area bound, {mask}°')
plt.xlabel('Độ cao / altitude (km)'); plt.ylabel('Số vệ tinh / satellites'); plt.legend(); plt.grid(alpha=.3, which='both'); plt.show()"""),
    (MD, """## Bài tập / Exercises

1. Trong mục 3, tìm chòm sao delta ít vệ tinh nhất ở 550 km, 53°, góc ngẩng 25° phủ Hà Nội 100 % thời gian. So với ước lượng mục 4. / Find the smallest 550 km, 53°, 25° delta pattern that covers Hanoi 100 % of the time; compare with section 4.
2. Lặp lại mục 2 cho OneWeb và Kuiper. Vì sao Kuiper (51,9°) có lúc không có vệ tinh nào trên 25°? / Repeat section 2 for OneWeb and Kuiper. Why does Kuiper sometimes have none above 25°?
3. Tính thời gian khứ hồi tối thiểu Hà Nội – Frankfurt qua cáp quang (hệ số tuyến 1,5, chiết suất 1,468) và qua LEO 480 km có laser. / Compute the minimum Hanoi–Frankfurt round trip by fibre and by LEO with lasers.

*Orbital elements: CelesTrak (https://celestrak.org).*"""),
]

if __name__ == "__main__":
    main(CELLS, "constellations_walker")
