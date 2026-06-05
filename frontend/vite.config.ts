import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // Số "phiên bản build" (mốc thời gian lúc build) — nhúng vào code để gắn ?v=<...> cho các asset
  // engine Kinh Mạch 3D (giữ-nguyên-tên trong public/). Mỗi lần build → số mới → URL mới → trình duyệt
  // buộc tải lại file mới, KỂ CẢ máy đã lỡ cache "immutable" 1 năm bởi cấu hình nginx cũ. Xem acuMap3d.ts.
  define: {
    __ACU_ASSET_VER__: JSON.stringify(String(Date.now())),
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
      '.ngrok.dev',
    ],
    // ĐỪNG reload trang khi backend ghi ảnh/bài (sinh ảnh AI vào public/blog-images, đăng bài vào content/blog).
    // Nếu không, Vite thấy file mới → full reload → HUỶ request đang chờ → trình duyệt báo "Failed to fetch"
    // (dù backend đã làm xong). Các file này vẫn được Vite phục vụ tĩnh bình thường.
    watch: {
      ignored: [
        '**/public/blog-images/**',
        '**/public/blog-assets/**',
        '**/content/blog/**',
      ],
    },
  },
  preview: {
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
      '.ngrok.dev',
    ],
  },
})
