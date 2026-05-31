import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/styles/main.css'
import { initTheme } from '@/composables/useTheme'

// Áp giao diện (màu theo ngày / theme đã ghim) trước khi render.
initTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
