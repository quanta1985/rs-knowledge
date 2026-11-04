import type { Bi } from '../i18n/ui';
import { isVeg, isWater, type Px, type Rect } from './ch08scenes';

export type Key = { id: string; name: Bi; scene: string; preset: string; row: number; col: number; zoom: number; text: Bi };

/** The nine classic interpretation keys, each with a real example. Positions checked against the spectra (scripts in the chapter notes). */
export const KEYS: Key[] = [
  { id: 'tone', name: { vi: 'Tông (độ sáng)', en: 'Tone' }, scene: 'danang', preset: 'true', row: 100, col: 385, zoom: 14.5,
    text: { vi: 'Sông Hàn tối hơn phố hai bên. Nước sông đục nên ở kênh nhìn thấy không tối hẳn, nhưng ở cận hồng ngoại nước hấp thụ gần hết (NDVI âm). Tông là yếu tố đầu tiên mắt nhận ra; thử đổi sang tổ hợp 8-4-3 ở Hình 8.1 để thấy sông tối hẳn.',
            en: 'The Han River is darker than the streets on both banks. The water is turbid, so it is not very dark in visible light, but water absorbs almost all near-infrared (negative NDVI). Tone is the first thing the eye picks up; switch to 8-4-3 in Figure 8.1 to see the river turn black.' } },
  { id: 'colour', name: { vi: 'Màu sắc', en: 'Colour' }, scene: 'dalat', preset: 'nir', row: 440, col: 440, zoom: 14,
    text: { vi: 'Trong tổ hợp giả màu 8-4-3, rừng hiện màu đỏ sẫm vì phản xạ cận hồng ngoại mạnh; đô thị xám xanh. Màu chỉ có nghĩa khi biết tổ hợp kênh.',
            en: 'In the 8-4-3 false colour, forest is deep red because it reflects near-infrared strongly; the town is blue-grey. Colour means nothing until you know the band combination.' } },
  { id: 'size', name: { vi: 'Kích thước', en: 'Size' }, scene: 'dalat', preset: 'true', row: 221, col: 319, zoom: 15,
    text: { vi: 'Hồ trung tâm Đà Lạt chiếm khoảng 3 300 pixel 10 m (≈ 0,33 km²), trong khi các ao trong vườn chỉ vài pixel. So kích thước với thước tỷ lệ để loại trừ.',
            en: 'The central lake of Da Lat covers about 3,300 pixels of 10 m (≈ 0.33 km²), while garden ponds are a few pixels. Compare sizes with the scale bar to rule things out.' } },
  { id: 'shape', name: { vi: 'Hình dạng', en: 'Shape' }, scene: 'danang', preset: 'true', row: 330, col: 120, zoom: 14,
    text: { vi: 'Hai dải thẳng, hẹp, rất dài và song song: chỉ đường băng sân bay có hình dạng như vậy. Đo chiều dài bằng thước tỷ lệ góc trái.',
            en: 'Two straight, narrow, very long parallel strips: only runways look like this. Measure the length with the scale bar.' } },
  { id: 'texture', name: { vi: 'Cấu trúc (độ nhám)', en: 'Texture' }, scene: 'angiang', preset: 'true', row: 100, col: 150, zoom: 14.5,
    text: { vi: 'Rừng trên Núi Cấm có cấu trúc lấm tấm, gồ ghề do tán cây cao thấp khác nhau; ruộng và hồ dưới chân núi mịn.',
            en: 'The forest on Cam Mountain has a mottled, rough texture from uneven crowns; the fields and ponds below are smooth.' } },
  { id: 'pattern', name: { vi: 'Mẫu hình', en: 'Pattern' }, scene: 'camau', preset: 'nir', row: 300, col: 250, zoom: 14.5,
    text: { vi: 'Các ô hẹp, dài, song song nhau và vuông góc với kênh rạch: mẫu hình của đầm nuôi tôm xen dải cây (mô hình tôm – rừng). Đây là diễn giải, chưa kiểm tra thực địa.',
            en: 'Narrow, long, parallel plots at right angles to the creeks: the pattern of shrimp ponds alternating with tree strips (shrimp–mangrove farming). This is an interpretation, not field-checked.' } },
  { id: 'shadow', name: { vi: 'Bóng', en: 'Shadow' }, scene: 'hanoi', preset: 'true', row: 235, col: 261, zoom: 14,
    text: { vi: 'Bóng mây nằm về phía tây bắc đám mây vì Mặt Trời chiếu từ hướng 147° (đông nam). Bóng cho biết hướng chiếu sáng và độ cao vật thể (Chương 7).',
            en: 'The cloud shadow lies north-west of its cloud because the Sun shines from azimuth 147° (south-east). Shadows reveal the light direction and object height (Chapter 7).' } },
  { id: 'site', name: { vi: 'Vị trí', en: 'Site' }, scene: 'angiang', preset: 'true', row: 323, col: 456, zoom: 14.5,
    text: { vi: 'Nhà cửa tập trung thành dải trên đất bằng chân núi, dọc theo đường. Vị trí địa hình giúp đoán: khu dân cư hiếm khi nằm trên sườn dốc.',
            en: 'Houses cluster in a strip on the flat land at the foot of the mountain, along the road. Site helps: settlements rarely sit on steep slopes.' } },
  { id: 'association', name: { vi: 'Liên quan', en: 'Association' }, scene: 'angiang', preset: 'true', row: 404, col: 338, zoom: 15,
    text: { vi: 'Khối xanh tím rất đều, chia ô lưới, có đường nội bộ, cạnh khu dân cư. Trông như nước nhưng MNDWI âm, nên nhiều khả năng là một cánh đồng tấm pin mặt trời (diễn giải; phóng to bản đồ nền để đối chiếu).',
            en: 'A very uniform blue-purple block divided into a grid with internal tracks, next to a settlement. It looks like water but its MNDWI is negative, so it is most likely a solar farm (interpretation; zoom the basemap to cross-check).' } },
];

export type Target = { id: string; scene: string; preset: string; q: Bi; rect: Rect; px?: Px; hint: Bi };
export const TARGETS: Target[] = [
  { id: 'river', scene: 'danang', preset: 'true', rect: [0, 512, 300, 430], px: isWater,
    q: { vi: 'Bấm vào sông Hàn.', en: 'Click on the Han River.' }, hint: { vi: 'Dải tối, rộng, chạy bắc – nam ở phía đông.', en: 'A dark, wide strip running north–south in the east.' } },
  { id: 'runway', scene: 'danang', preset: 'true', rect: [150, 495, 60, 130], px: (b) => (b.B8 - b.B4) / (b.B8 + b.B4) < 0.2,
    q: { vi: 'Bấm vào sân bay (đường băng hoặc sân đỗ).', en: 'Click on the airport (runway or apron).' }, hint: { vi: 'Dải thẳng rất dài ở phía tây.', en: 'A very long straight strip in the west.' } },
  { id: 'lake', scene: 'dalat', preset: 'true', rect: [140, 300, 230, 420], px: isWater,
    q: { vi: 'Bấm vào hồ ở trung tâm Đà Lạt.', en: 'Click on the lake in central Da Lat.' }, hint: { vi: 'Mảng đen hình lưỡi liềm giữa ảnh.', en: 'The dark crescent in the middle.' } },
  { id: 'forest', scene: 'dalat', preset: 'nir', rect: [0, 512, 0, 512], px: isVeg,
    q: { vi: 'Bấm vào một vùng cây rậm (rừng).', en: 'Click on dense vegetation (forest).' }, hint: { vi: 'Ở tổ hợp 8-4-3, cây rậm có màu đỏ đậm.', en: 'In the 8-4-3 composite dense vegetation is deep red.' } },
  { id: 'solar', scene: 'angiang', preset: 'true', rect: [330, 512, 245, 415],
    q: { vi: 'Bấm vào khu vực trông như nước nhưng không phải nước.', en: 'Click on the area that looks like water but is not.' }, hint: { vi: 'Khối xanh tím chia ô đều ở phía nam.', en: 'The gridded blue-purple block in the south.' } },
  { id: 'pond', scene: 'camau', preset: 'nir', rect: [0, 512, 0, 512], px: isWater,
    q: { vi: 'Bấm vào một ô đầm đang ngập nước.', en: 'Click on a flooded pond.' }, hint: { vi: 'Ở tổ hợp 8-4-3, nước có màu xanh lam đến đen.', en: 'In the 8-4-3 composite water is blue to black.' } },
  { id: 'trees', scene: 'camau', preset: 'nir', rect: [0, 512, 0, 512], px: isVeg,
    q: { vi: 'Bấm vào một dải cây (rừng ngập mặn).', en: 'Click on a strip of trees (mangrove).' }, hint: { vi: 'Dải đỏ đậm xen giữa các ô đầm.', en: 'Deep red strips between the ponds.' } },
  { id: 'shadow', scene: 'hanoi', preset: 'true', rect: [200, 272, 222, 302], px: (b) => (b.B2 + b.B3 + b.B4) / 3 < 0.08,
    q: { vi: 'Bấm vào bóng của đám mây lớn nhất.', en: 'Click on the shadow of the largest cloud.' }, hint: { vi: 'Mảng tối ở phía tây bắc đám mây.', en: 'The dark patch north-west of the cloud.' } },
];
