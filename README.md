# Sổ tay Viễn thám & GIS · Remote Sensing & GIS Handbook

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

- Nội dung / content: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Ảnh vệ tinh / imagery: *Contains modified Copernicus Sentinel data (2019–2024).* Landsat courtesy of the U.S. Geological Survey. MODIS courtesy of NASA LP DAAC. ESA WorldCover 2021 (CC BY 4.0).
- Cách trình bày tương tác lấy cảm hứng từ / interactive presentation inspired by *Sổ tay Vệ tinh & Viễn thám* — Nguyễn Văn Tín (Estas Nino), CC BY 4.0. Chương nào cải biên từ tác phẩm đó sẽ ghi nguồn ngay trong chương. / Chapters adapted from that work will credit it in the chapter itself.
