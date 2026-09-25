import i18next from 'i18next'
import { configureLazyI18n } from './utils/capabilities/resources'

const hasCreateInstance = typeof i18next.createInstance === 'function'
const testI18n = hasCreateInstance ? i18next.createInstance() : i18next

if (hasCreateInstance) {
  const reactI18next = await import('react-i18next')
  let initReactI18next
  try {
    initReactI18next = reactI18next.initReactI18next
  } catch {
    // File-local test mocks may omit the integration plugin.
  }
  if (initReactI18next) {
    testI18n.use(initReactI18next)
  }

  await testI18n.init({
    resources: { en: {} },
    defaultNS: 'common',
    lng: 'en',
    interpolation: { escapeValue: false },
    initImmediate: false
  })
  configureLazyI18n(testI18n)
}

export default testI18n
