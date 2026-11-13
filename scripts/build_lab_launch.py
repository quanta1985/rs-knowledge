"""Generate labs/launch_rocket.ipynb (Colab). No Earth Engine needed.

    cd scripts && python build_lab_launch.py [--run]
"""
from labkit import MD, PY, main

CELLS = [
    (MD, """# Lab 3 — Phóng vệ tinh: phương trình tên lửa / Launching satellites: the rocket equation

**Sổ tay Viễn thám & GIS — Chương 3** · [Mở chương / Open chapter](https://quanta1985.github.io/rs-knowledge/vi/launch/)

1. Phương trình tên lửa Tsiolkovsky / The Tsiolkovsky rocket equation.
2. Tách tầng: tìm cách chia khối lượng tối ưu / Staging: the best mass split.
3. Δv theo vĩ độ bãi phóng cho LEO, SSO, GEO / Δv versus launch latitude for LEO, SSO, GEO.
4. Khẩu pháo Newton bằng tích phân số / Newton's cannon by numerical integration."""),
    (PY, """import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import minimize_scalar
from scipy.integrate import solve_ivp

G0, MU, RE, OMEGA = 9.80665, 398600.4418, 6378.137, 7.2921159e-5   # m/s², km³/s², km, rad/s
LOSSES, PARK = 1.7, 200        # km/s tổn thất giả định / assumed losses; km quỹ đạo chờ / parking orbit
def dv(isp, ratio): return isp * G0 * np.log(ratio) / 1000          # km/s
def vcirc(h): return np.sqrt(MU / (RE + h))"""),
    (MD, "## 1. Phương trình tên lửa / Rocket equation"),
    (PY, """for isp in (280, 320, 450):
    print(f'Isp {isp} s: ratio 10 -> {dv(isp, 10):.2f} km/s; ratio for 9.3 km/s = {np.exp(9300 / (isp * G0)):.1f}')

r = np.linspace(1, 30, 300)
for isp in (280, 320, 450):
    plt.plot(r, dv(isp, r), label=f'Isp {isp} s')
plt.axhline(9.3, ls='--', c='k', lw=1); plt.text(1.5, 9.5, 'LEO ≈ 9.3 km/s')
plt.xlabel('m0 / mf'); plt.ylabel('Δv (km/s)'); plt.legend(); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 2. Tách tầng / Staging

Hai tầng khác Isp: chọn tỉ lệ λ₁ (khối lượng tầng 2 + tải / khối lượng cất cánh) sao cho tải trọng lớn nhất mà vẫn đạt Δv cần.
Two stages with different Isp: choose λ₁ (stage-2 + payload / lift-off mass) to maximise payload while reaching the needed Δv."""),
    (PY, """EPS = 0.10                                  # kết cấu / (kết cấu + nhiên liệu) mỗi tầng / structural ratio per stage
ISP1, ISP2 = 280, 450
need = np.sqrt(vcirc(PARK)**2 + (OMEGA * RE * np.cos(np.radians(5.2)))**2 - 2 * vcirc(PARK) * OMEGA * RE * np.cos(np.radians(5.2))) + LOSSES
print(f'Δv cần lên LEO từ Kourou / needed from Kourou: {need:.3f} km/s')

def stage_dv(isp, lam): return dv(isp, 1 / (lam + EPS * (1 - lam)))
def payload(lam1):
    # với λ₁ cho trước, tìm λ₂ để tổng Δv = need / given λ1, solve λ2 so total Δv = need
    rest = need - stage_dv(ISP1, lam1)
    if rest <= 0: return lam1
    R = np.exp(rest * 1000 / (ISP2 * G0)); lam2 = (1 / R - EPS) / (1 - EPS)
    return lam1 * lam2 if lam2 > 0 else 0.0

lams = np.linspace(0.05, 0.6, 300)
pay = np.array([payload(l) for l in lams])
best = minimize_scalar(lambda l: -payload(l), bounds=(0.05, 0.6), method='bounded')
print(f'tốt nhất / best λ1 = {best.x:.3f}, tải trọng / payload = {100 * payload(best.x):.2f} % khối lượng cất cánh / of lift-off mass')
plt.plot(lams, 100 * pay); plt.axvline(best.x, ls='--', c='k', lw=1)
plt.xlabel('λ1'); plt.ylabel('Tải trọng / payload (%)'); plt.grid(alpha=.3); plt.show()"""),
    (MD, """## 3. Δv theo vĩ độ bãi phóng / Δv versus launch latitude

sin β = cos i / cos φ. Δv tên lửa = |v⃗ quỹ đạo − v⃗ mặt đất| + tổn thất. GEO: thêm lần đốt LEO→GTO và lần đốt ở viễn điểm xóa độ nghiêng φ.
Rocket Δv = |v_orbit − v_ground| + losses. GEO adds the LEO→GTO burn and the apogee burn removing inclination φ."""),
    (PY, """R1, RG = RE + PARK, 42164.137
def to_orbit(lat, inc):
    s = np.cos(np.radians(inc)) / np.cos(np.radians(lat))
    if abs(s) > 1: return np.nan
    v, vr = vcirc(PARK), OMEGA * RE * np.cos(np.radians(lat))
    return np.sqrt(v**2 + vr**2 - 2 * v * vr * s) + LOSSES
gto = vcirc(PARK) * (np.sqrt(2 * RG / (R1 + RG)) - 1)
va, vg = np.sqrt(MU / RG) * np.sqrt(2 * R1 / (R1 + RG)), np.sqrt(MU / RG)
def geo_ins(i): return np.sqrt(va**2 + vg**2 - 2 * va * vg * np.cos(np.radians(i)))

lat = np.linspace(0, 60, 121)
plt.plot(lat, [to_orbit(p, p) for p in lat], label='LEO, i = φ')
plt.plot(lat, [to_orbit(p, 98) for p in lat], label='SSO 98°')
plt.plot(lat, [to_orbit(p, p) + gto + geo_ins(p) for p in lat], label='GEO (tổng / total)')
for name, p in [('Kourou', 5.2), ('Canaveral', 28.6), ('Tanegashima', 30.4), ('Baikonur', 46.0)]:
    plt.axvline(p, c='grey', lw=.6); plt.text(p + .5, 9.2, name, rotation=90, fontsize=8)
plt.xlabel('Vĩ độ bãi phóng / launch latitude (°)'); plt.ylabel('Δv (km/s)'); plt.legend(); plt.grid(alpha=.3); plt.show()
print(f'GTO burn {gto:.3f} km/s; GEO insertion 5.2°: {geo_ins(5.2):.3f}, 46°: {geo_ins(46):.3f} km/s')"""),
    (MD, "## 4. Khẩu pháo Newton / Newton's cannon"),
    (PY, """def shot(h, v, tmax=6 * 3600):
    hit = lambda t, s: np.hypot(s[0], s[1]) - RE; hit.terminal = True
    return solve_ivp(lambda t, s: [s[2], s[3], -MU * s[0] / np.hypot(s[0], s[1])**3, -MU * s[1] / np.hypot(s[0], s[1])**3],
                     (0, tmax), [0, RE + h, v, 0], events=hit, max_step=20, rtol=1e-9)

th = np.linspace(0, 2 * np.pi, 400)
plt.figure(figsize=(6, 6)); plt.fill(RE * np.cos(th), RE * np.sin(th), color='#dcf0f2')
for v in (5, 6, 7, vcirc(400), 9):
    s = shot(400, v); plt.plot(s.y[0], s.y[1], label=f'{v:.2f} km/s')
plt.gca().set_aspect(1); plt.legend(); plt.title('400 km'); plt.show()
print(f'v tròn / circular {vcirc(400):.3f} km/s, v thoát / escape {np.sqrt(2) * vcirc(400):.3f} km/s')"""),
    (MD, """## Bài tập / Exercises

1. Đổi `ISP1 = 300, ISP2 = 300` (hai tầng giống nhau). λ₁ tối ưu có bằng √(tải trọng) không? / With equal stages, is the best λ1 the square root of the payload fraction?
2. Thêm bãi phóng ở vĩ độ Hà Nội (21° B) vào hình 3. / Add a site at Hanoi's latitude (21° N) to plot 3.
3. Bắn ở 100 km thay vì 400 km: vận tốc vòng tròn đổi thế nào? / Fire from 100 km: how does circular speed change?"""),
]

if __name__ == "__main__":
    main(CELLS, "launch_rocket")
