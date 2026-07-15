import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

const LANGUAGE_STORAGE_KEY = 'litematic-studio-language'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
})

if (import.meta.env.DEV) {
  i18n.on('missingKey', (_lngs, _ns, key) => {
    console.warn(`[i18n] Missing translation key: "${key}"`)
  })
}

export default i18n
