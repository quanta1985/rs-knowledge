"""Generate labs/satellite_power.ipynb (Colab). No Earth Engine needed; installs pymsis (NRLMSIS 2.1) if missing.

    cd scripts && python build_lab_bus.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 4 — Vận hành vệ tinh: điện, bóng Trái Đất và tuổi thọ quỹ đạo / Satellite operations: power, eclipse and orbital lifetime

**Sổ tay Viễn thám & GIS — Chương 4** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/satellite-bus/)

1. Phần bóng tối theo độ cao và góc beta / Eclipse fraction versus altitude and beta angle.
2. Góc beta trong một năm: SSO 10:30 và bình minh – hoàng hôn / Beta over a year: 10:30 SSO and dawn–dusk.
3. Ngân sách điện và mức ắc quy / Power budget and battery charge.
4. Tuổi thọ quỹ đạo với mật độ NRLMSIS 2.1 / Orbital lifetime with NRLMSIS 2.1 density."""),
    (PY, """import subprocess, sys
try:
    import pymsis
except ImportError:                     # Colab: cài mô hình khí quyển / install the atmosphere model
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'pymsis'], check=True)
    import pymsis
import numpy as np
import matplotlib.pyplot as plt

MU, RE, SOLAR = 398600.4418, 6378.137, 1361.0      # km³/s², km, W/m²
def period_min(h): return 2 * np.pi * np.sqrt((RE + h)**3 / MU) / 60
def eclipse(h, beta_deg):
    r, b = RE + h, np.radians(np.abs(beta_deg))
    x = np.sqrt(h**2 + 2 * RE * h) / (r * np.cos(b))
    return np.where(np.sin(b) >= RE / r, 0.0, np.arccos(np.clip(x, -1, 1)) / np.pi)
def beta(inc, node_from_sun, decl):
    i, d, n = np.radians(inc), np.radians(decl), np.radians(node_from_sun)
    return np.degrees(np.arcsin(np.cos(d) * np.sin(i) * np.sin(n) + np.sin(d) * np.cos(i)))"""),
    (MD, "## 1. Phần bóng tối / Eclipse fraction"),
    (PY, """for h in (400, 700, 786):
    print(f'{h} km: chu kỳ / period {period_min(h):.1f} min, beta 0 -> {100 * eclipse(h, 0):.1f} % in shadow, '
          f'beta tới hạn / critical {np.degrees(np.arcsin(RE / (RE + h))):.1f}°')
b = np.linspace(0, 80, 400)
for h in (400, 786, 1200):
    plt.plot(b, 100 * eclipse(h, b), label=f'{h} km')
plt.xlabel('beta (°)'); plt.ylabel('% vòng trong bóng / % of orbit in shadow'); plt.legend(); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 2. Góc beta trong một năm / Beta over a year

Xích vĩ Mặt Trời gần đúng δ = 23,44° · sin(2π (ngày − 80) / 365,25). Với SSO, Ω − α☉ cố định: nút giảm 10:30 → 157,5°, nút tăng 18:00 → 90°.
Approximate solar declination; for an SSO, Ω − α☉ is fixed: 10:30 descending node → 157.5°, 18:00 ascending node → 90°."""),
    (PY, """day = np.arange(365)
decl = 23.44 * np.sin(2 * np.pi * (day - 80) / 365.25)
b_s2 = beta(98.62, 157.5, decl)        # Sentinel-2, 786 km
b_s1 = beta(98.18, 90.0, decl)         # Sentinel-1, 693 km, dawn-dusk
print(f'Sentinel-2 beta {b_s2.min():.1f}..{b_s2.max():.1f}°, shadow {100 * eclipse(786, b_s2).min():.1f}..{100 * eclipse(786, b_s2).max():.1f} %')
print(f'Sentinel-1 beta {b_s1.min():.1f}..{b_s1.max():.1f}°, shadow max {100 * eclipse(693, b_s1).max():.1f} %')
fig, ax = plt.subplots(1, 2, figsize=(11, 3.5))
ax[0].plot(day, b_s2, label='Sentinel-2 (10:30)'); ax[0].plot(day, b_s1, label='Sentinel-1 (18:00)'); ax[0].set_ylabel('beta (°)')
ax[1].plot(day, period_min(786) * eclipse(786, b_s2), label='Sentinel-2'); ax[1].plot(day, period_min(693) * eclipse(693, b_s1), label='Sentinel-1')
ax[1].set_ylabel('phút trong bóng / min in shadow')
for a in ax: a.set_xlabel('ngày trong năm / day of year'); a.legend(); a.grid(alpha=.3)
plt.tight_layout(); plt.show()"""),
    (MD, """## 3. Ngân sách điện / Power budget

SMAD §11.4: P_sa = (P·T_e/X_e + P·T_d/X_d) / T_d với X_e = 0,6, X_d = 0,8; hệ số suy giảm vốn có I_d = 0,77.
SMAD §11.4 array sizing with X_e = 0.6, X_d = 0.8 and inherent degradation I_d = 0.77."""),
    (PY, """def power(h=786, b=22.2, area=2.5, eff=0.28, load=300, batt_wh=900, orbits=3, eta=0.9):
    T, f = period_min(h), float(eclipse(h, b))
    gen = SOLAR * eff * 0.77 * area
    t = np.linspace(0, orbits * T, 240 * orbits + 1); dt = t[1] - t[0]
    wh, soc = batt_wh, [100.0]
    for ti in t[1:]:
        dark = (ti % T) / T > 1 - f
        net = -load if dark else (gen - load) * (eta if gen > load else 1)
        wh = min(batt_wh, max(0.0, wh + net * dt / 60)); soc.append(100 * wh / batt_wh)
    te, td = T * f, T * (1 - f)
    need = (load * te / 0.6 + load * td / 0.8) / td
    return t, np.array(soc), gen, need, need / (SOLAR * eff * 0.77)

for area in (2.5, 1.2):
    t, soc, gen, need, need_area = power(area=area)
    print(f'{area} m²: phát / output {gen:.0f} W, cần / needed {need:.0f} W = {need_area:.2f} m², DoD {100 - soc.min():.1f} %')
    plt.plot(t, soc, label=f'{area} m²')
plt.xlabel('phút / min'); plt.ylabel('mức pin / charge (%)'); plt.legend(); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 4. Tuổi thọ quỹ đạo / Orbital lifetime

da/dt = −√(μa) · ρ(a) · B, B = Cd·A/m. Mật độ NRLMSIS 2.1, trung bình theo vĩ độ và giờ địa phương, F10.7 = 70 (Mặt Trời yên) và 200 (mạnh).
NRLMSIS 2.1 density averaged over latitude and local time, F10.7 = 70 (quiet) and 200 (active)."""),
    (PY, """alts = np.arange(100, 1001, 10)
def mean_rho(f107):
    out = pymsis.calculate(np.datetime64('2020-03-20T12:00'), np.arange(0, 360, 30), np.arange(-60, 61, 30), alts,
                           f107s=[f107], f107as=[f107], aps=[[15] * 7], version=2.1)
    return np.squeeze(out)[..., pymsis.Variable.MASS_DENSITY].mean(axis=(0, 1))
rho = {'low': mean_rho(70.0), 'high': mean_rho(200.0)}

def lifetime_years(h0, B, k):
    h = np.arange(h0, 150, -1) - 0.5
    r = np.exp(np.interp(h, alts, np.log(rho[k])))
    a = (RE + h) * 1000
    return np.sum(1000 / (np.sqrt(MU * 1e9 * a) * r * B)) / (365.25 * 86400)

B_pico = 2.2 * (2 * 0.01 + 4 * 0.01135) / 4 / 0.983      # PicoDragon 1U
B_micro = 2.2 * 1.5 * 0.25 / 50                          # MicroDragon 50 kg
print(f'PicoDragon 415 km: {365.25 * lifetime_years(415, B_pico, "high"):.0f}..{365.25 * lifetime_years(415, B_pico, "low"):.0f} ngày / days (thực tế / real 101)')
print(f'MicroDragon 500 km: {lifetime_years(500, B_micro, "high"):.1f}..{lifetime_years(500, B_micro, "low"):.1f} năm / years (thực tế / real 5.7)')
H = np.arange(300, 901, 10)
for k, ls in (('low', '-'), ('high', '--')):
    plt.semilogy(H, [lifetime_years(h, 0.02, k) for h in H], ls, label=f'B 0.02, F10.7 {"70" if k == "low" else "200"}')
plt.axhline(5, c='r', lw=1); plt.axhline(25, c='k', lw=1, ls=':')
plt.xlabel('độ cao ban đầu / start altitude (km)'); plt.ylabel('năm / years'); plt.legend(); plt.grid(alpha=.3, which='both'); plt.show()"""),
    (MD, """## Bài tập / Exercises

1. CubeSat 3U với pin gắn thân 0,03 m² mỗi mặt, tải 5 W, 500 km, beta 0°: đủ điện không? / Body-mounted 3U, 0.03 m² per face, 5 W load: enough power?
2. Ở độ cao nào CubeSat 3U (B ≈ 0,0215 m²/kg) rơi trong 5 năm dù Mặt Trời yên? / Highest release altitude for a 3U to re-enter within 5 years even with a quiet Sun?
3. Thay F10.7 = 140 (trung bình) và so với hai đường trên. / Try F10.7 = 140 (average) and compare."""),
]

if __name__ == "__main__":
    main(CELLS, "satellite_power")
