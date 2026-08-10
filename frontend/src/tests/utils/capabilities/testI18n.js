import i18next from 'i18next'
import { loadI18nResources } from './resources'

const hasCreateInstance = typeof i18next.createInstance === 'function'
const testI18n = hasCreateInstance ? i18next.createInstance() : i18next
const reactI18next = await import('react-i18next')
let initReactI18next

try {
  initReactI18next = reactI18next.initReactI18next
} catch {
  // File-local test mocks may omit the integration plugin.
}

if (hasCreateInstance && initReactI18next) {
  testI18n.use(initReactI18next)
}

if (hasCreateInstance) {
  await testI18n.init({
    resources: await loadI18nResources(),
    defaultNS: 'common',
    lng: 'en',
    interpolation: { escapeValue: false }
  })
}

export default testI18n
