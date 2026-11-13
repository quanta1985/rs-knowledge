# GIS and Remote Sensing Knowledge

Sổ tay song ngữ (Việt–Anh) phục vụ tra cứu và giảng dạy viễn thám. Mỗi khái niệm đi kèm hình tương tác và ví dụ tính trên ảnh vệ tinh thật của Việt Nam.
A bilingual (Vietnamese–English) handbook for teaching and reference. Every concept comes with an interactive figure and a worked example on real satellite imagery of Viet Nam.

**Website:** https://quanta1985.github.io/rs-knowledge/

## Nội dung hiện có / Current content

- **Chương 4 — Bốn loại độ phân giải**: cùng khung Hồ Tây qua Sentinel-2 / Landsat 9 / MODIS, mô phỏng gộp pixel, pixel hỗn hợp, số kênh, số bit, số ảnh không mây theo tháng (Hà Nội vs An Giang 2019–2024).
- **Chương 6 — Đặc trưng phổ & chỉ số phổ**: đường cong phổ, tổ hợp màu, NDVI/NDWI/MNDWI/NDBI, ngưỡng Otsu (Sentinel-2, Hà Nội 12/02/2024), chuỗi NDVI lúa An Giang 2023–2024.
- Lab Python (Colab) và script GEE: [`labs/`](labs/).
- Các chương khác: xem lộ trình trên trang chủ / see the roadmap on the home page.

## Chạy cục bộ / Run locally

```bash
npm install
npm run dev        # http://localhost:4321/rs-knowledge/
npm test           # unit tests (node:test)
npm run build      # static site + Pagefind search index in dist/
```

Dữ liệu ảnh được tạo lại bằng / Imagery is regenerated with `scripts/data/*.py` (cần tài khoản Google Earth Engine / needs a GEE account).

## Giấy phép & ghi công / License & attribution

- © 2026 Trần Anh Quân · quantrananh.humg@gmail.com. Nội dung / content: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Ảnh vệ tinh / imagery: *Contains modified Copernicus Sentinel data (2019–2024).* Landsat courtesy of the U.S. Geological Survey. MODIS courtesy of NASA LP DAAC. ESA WorldCover 2021 (CC BY 4.0).
- Nguồn tham khảo của một số chương Phần A được ghi tại chương 21 (Tra cứu). / Sources for some Part A chapters are credited in Chapter 21 (Reference).
