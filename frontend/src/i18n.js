import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonEn from '@/assets/locales/en/common.json'
import orgEn from '@/assets/locales/en/organization.json'
import adminEn from '@/assets/locales/en/admin.json'
import reportEn from '@/assets/locales/en/reports.json'
import fuelCodeEn from '@/assets/locales/en/fuelCode.json'
import txnEn from '@/assets/locales/en/transaction.json'
import transferEn from '@/assets/locales/en/transfer.json'
import internalCommentEn from '@/assets/locales/en/internalComment.json'
import adminAdjustmentEn from '@/assets/locales/en/adminAdjustment.json'
import initiativeAgreementEn from '@/assets/locales/en/initiativeAgreement.json'
import notionalTransferEn from '@/assets/locales/en/notionalTransfer.json'

// manage translations separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    // Namespaces
    common: commonEn,
    admin: adminEn,
    report: reportEn,
    fuelCode: fuelCodeEn,
    org: orgEn,
    txn: txnEn,
    transfer: transferEn,
    internalComment: internalCommentEn,
    administrativeAdjustment: adminAdjustmentEn,
    initiativeAgreement: initiativeAgreementEn,
    notionalTransfer: notionalTransferEn,
  }
}

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    defaultNS: 'common',
    lng: 'en', // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option

    interpolation: {
      escapeValue: false
    }
  })

export default i18n
