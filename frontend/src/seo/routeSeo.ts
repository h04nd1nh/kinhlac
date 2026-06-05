// routeSeo.ts — Dữ liệu SEO cho TỪNG trang công khai (khoá theo TÊN route trong router).
//
// Muốn sửa tiêu đề/mô tả 1 trang: chỉ cần sửa ở đây, không đụng component.
// App.vue tự đọc map này theo route hiện tại và áp lên thẻ <head> (xem useSeo.ts).
//
// Quy tắc: title <= 60 ký tự, description <= 155 ký tự (đã được rà bởi reviewer SEO).
import type { SeoData } from '@/composables/useSeo'

export const routeSeo: Record<string, SeoData> = {
  // Trang chủ / landing
  landing: {
    title: 'Phần Mềm Đo Kinh Lạc & Quản Lý Phòng Khám Đông Y',
    description:
      'Phần mềm Đông Y số hoá: đo nhiệt độ kinh lạc ra biểu đồ, chẩn đoán thể bệnh, đồ hình 3D, tra cứu huyệt vị & quản lý phòng khám. Trải nghiệm miễn phí.',
    keywords: [
      'phần mềm đo kinh lạc',
      'phần mềm quản lý phòng khám Đông Y',
      'phần mềm y học cổ truyền',
      'số hoá phòng khám Đông Y',
      'đo kinh lạc',
      'chẩn đoán Đông Y',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Phần Mềm Đo Kinh Lạc & Quản Lý Phòng Khám Đông Y',
      description:
        'Phần mềm Y Học Cổ Truyền số hoá: đo nhiệt độ 12 đường kinh thành biểu đồ, tự gợi ý thể bệnh và pháp trị, đồ hình kinh lạc 3D, tra cứu hơn 1.000 huyệt vị và quản lý hồ sơ bệnh nhân phòng khám Đông Y.',
      url: 'https://kinhlac.online/',
      inLanguage: 'vi',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'VND',
        description: 'Khám phá kho tri thức, đồ hình 3D và ca đo mẫu miễn phí, không cần đăng nhập.',
      },
      featureList: [
        'Đo nhiệt độ kinh lạc 12 đường kinh',
        'Chẩn đoán thể bệnh và pháp trị bằng dữ liệu',
        'Đồ hình kinh lạc 3D với hơn 1.000 huyệt vị',
        'Phân tích bài thuốc theo tính vị quy kinh',
        'Quản lý hồ sơ bệnh nhân phòng khám Đông Y',
      ],
    },
  },

  // Từ điển tra cứu công khai
  'thu-vien': {
    title: 'Từ Điển Huyệt Vị, 12 Đường Kinh & Kinh Lạc',
    description:
      'Tra cứu hơn 1.000 huyệt vị, 12 đường kinh và kỳ kinh bát mạch: vị trí, chủ trị, châm cứu trị bệnh, bệnh học. Miễn phí, không cần đăng nhập.',
    keywords: [
      'từ điển Đông Y',
      'tra cứu huyệt vị',
      'huyệt vị',
      '12 đường kinh',
      'kỳ kinh bát mạch',
      'châm cứu trị bệnh',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Từ Điển Tra Cứu Đông Y: Huyệt Vị, Kinh Lạc & Châm Cứu',
      description:
        'Thư viện tra cứu Đông Y công khai: hơn 1.000 huyệt vị (vị trí, chủ trị, châm cứu), 12 chính kinh, kỳ kinh bát mạch, kỳ huyệt, châm cứu trị bệnh và bệnh học. Miễn phí, không cần đăng nhập.',
      url: 'https://kinhlac.online/thu-vien',
      inLanguage: 'vi',
      isAccessibleForFree: true,
      about: [
        { '@type': 'Thing', name: 'Huyệt vị' },
        { '@type': 'Thing', name: 'Kinh lạc' },
        { '@type': 'Thing', name: 'Châm cứu' },
      ],
      isPartOf: { '@type': 'WebSite', name: 'Kinh Lạc', url: 'https://kinhlac.online' },
    },
  },

  // Đồ hình kinh lạc 3D
  'xem-3d': {
    title: 'Đồ Hình Kinh Lạc 3D - Xem 12 Đường Kinh & Huyệt Vị',
    description:
      'Khám phá đồ hình kinh lạc 3D tương tác: xoay xem 12 đường kinh, bấm vào huyệt, tìm kiếm bay tới huyệt vị. Xem thử miễn phí, không cần cài đặt.',
    keywords: [
      'đồ hình kinh lạc 3D',
      'kinh lạc 3D',
      'đồ hình huyệt vị 3D',
      'mô hình kinh lạc 3D',
      'đồ hình châm cứu 3D',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Đồ Hình Kinh Lạc 3D - Xem 12 Đường Kinh & Huyệt Vị',
      description:
        'Đồ hình kinh lạc và huyệt vị 3D tương tác: xoay xem 12 đường kinh, bấm vào huyệt để tra cứu, tìm kiếm để bay tới huyệt. Công cụ học tập Đông Y trực tuyến, xem thử miễn phí trên trình duyệt.',
      url: 'https://kinhlac.online/xem-3d',
      inLanguage: 'vi',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript and WebGL',
      isAccessibleForFree: true,
      featureList: [
        'Đồ hình kinh lạc 3D tương tác',
        'Xem 12 đường kinh trên mô hình 3D',
        'Tìm kiếm và bay tới huyệt',
        'Xoay, phóng to đồ hình trực quan',
      ],
    },
  },

  // Demo kết quả đo kinh lạc
  'xem-ket-qua-do': {
    title: 'Kết Quả Đo Kinh Lạc: Nhiệt Độ 12 Kinh & Bát Cương',
    description:
      'Xem bản đo kinh lạc thật: chỉ số nhiệt độ 12 đường kinh, kinh cường - kinh nhược, kết luận Bát Cương và thể bệnh Đông Y. Dùng thử miễn phí.',
    keywords: [
      'kết quả đo kinh lạc',
      'đo nhiệt độ kinh lạc',
      'chẩn đoán kinh lạc',
      'Bát Cương',
      'thể bệnh Đông Y',
      'kinh cường kinh nhược',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Kết Quả Đo Kinh Lạc - Nhiệt Độ 12 Đường Kinh & Bát Cương',
      description:
        'Trang xem thử kết quả đo kinh lạc thật: bảng chỉ số nhiệt độ 12 đường kinh chi trên và chi dưới, suy ra kinh cường - kinh nhược, kết luận Bát Cương và các thể bệnh Đông Y, Y Học Hiện Đại đo được.',
      url: 'https://kinhlac.online/xem-ket-qua-do',
      inLanguage: 'vi',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
      featureList: [
        'Bảng chỉ số nhiệt độ 12 đường kinh',
        'Phân tích kinh cường - kinh nhược chi trên và chi dưới',
        'Kết luận Bát Cương',
        'Nhận diện thể bệnh Đông Y và Y Học Hiện Đại',
      ],
    },
  },

  // Demo phân tích bài thuốc
  'xem-bai-thuoc': {
    title: 'Phân Tích Bài Thuốc Theo Tính Vị Quy Kinh',
    description:
      'Xem thử phân tích bài thuốc Đông Y theo tính vị quy kinh: Tứ Khí, Ngũ Vị, Quy Kinh, Quân-Thần-Tá-Sứ bằng biểu đồ radar. Tra cứu miễn phí.',
    keywords: [
      'bài thuốc Đông Y',
      'tính vị quy kinh',
      'phân tích bài thuốc Đông Y',
      'vị thuốc',
      'quân thần tá sứ',
      'tứ khí ngũ vị',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Phân Tích Bài Thuốc Theo Tính Vị Quy Kinh',
      description:
        'Công cụ xem thử phân tích bài thuốc Đông Y theo tính vị quy kinh: Tứ Khí, Ngũ Vị, Quy Kinh, Thăng-Giáng-Phù-Trầm và cấu trúc Quân-Thần-Tá-Sứ thể hiện bằng biểu đồ radar.',
      url: 'https://kinhlac.online/xem-bai-thuoc',
      inLanguage: 'vi',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    },
  },
}

// Mặc định cho các trang KHÔNG khai báo ở trên (app nội bộ, login…).
// App.vue sẽ tự đặt index=false cho trang riêng tư (requiresAuth) để không lên Google.
export const defaultSeo: SeoData = {
  title: 'Phần Mềm Đo Kinh Lạc & Y Học Cổ Truyền — Kinh Lạc',
  description: 'Đông Y nghìn năm giờ đọc được bằng dữ liệu: đo kinh lạc, đồ hình 3D, tra cứu huyệt vị.',
  index: true,
}
