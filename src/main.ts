import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets, setupScrollbarStyle } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'
import {fpjsPlugin, FpjsVueOptions, FingerprintJSPro,} from '@fingerprintjs/fingerprintjs-pro-vue-v3';

async function bootstrap() {
  const apiKey = 'qZDF6BPuOo8c5lsP8wQ6'  //import.meta.env.FINGERPRINT_API_PUBLIC_KEY;
  const app = createApp(App)
  setupAssets()

  setupScrollbarStyle()

  setupStore(app)

  setupI18n(app)

  await setupRouter(app)

  app.use(fpjsPlugin, {
    loadOptions: {
      apiKey: apiKey,
    },
  } as FpjsVueOptions).mount('#app')
}

bootstrap()
