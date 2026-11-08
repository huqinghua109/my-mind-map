import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './style/global.css'
import '@/mindmap/style/icon-font/iconfont.css'
import '@/mindmap/style/mindmap.less'
import bus from '@/mindmap/bus'
import { t } from '@/mindmap/i18n'
import { useEditorStore, setEditorStore } from '@/mindmap/store'
import elementCompat from '@/mindmap/element-compat'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
setEditorStore(useEditorStore(pinia))

app.use(elementCompat)
app.config.globalProperties.$bus = bus
app.config.globalProperties.$t = t
app.config.globalProperties.$i18n = { locale: 'zh' }

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(router)
app.use(ElementPlus)
app.mount('#app')
