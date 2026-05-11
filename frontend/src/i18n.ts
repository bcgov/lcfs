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
import otherUsesEn from '@/assets/locales/en/otherUses.json'
import finalSupplyEquipmentEn from '@/assets/locales/en/finalSupplyEquipment.json'
import fuelSupplyEn from '@/assets/locales/en/fuelSupply.json'
import fuelExportEn from '@/assets/locales/en/fuelExport.json'
import dashboardEn from '@/assets/locales/en/dashboard.json'
import allocationAgreementEn from '@/assets/locales/en/allocationAgreement.json'
import notificationsEn from '@/assets/locales/en/notifications.json'
import creditMarketEn from '@/assets/locales/en/creditMarket.json'
import chargingEquipmentEn from '@/assets/locales/en/chargingEquipment.json'
import chargingSiteEn from '@/assets/locales/en/chargingSite.json'
import bulletinEn from '@/assets/locales/en/bulletins.json'

// manage translations separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    common: commonEn,
    admin: adminEn,
    report: reportEn,
    // Alias to support components referencing `reports:` keys
    reports: reportEn,
    fuelCode: fuelCodeEn,
    org: orgEn,
    txn: txnEn,
    transfer: transferEn,
    internalComment: internalCommentEn,
    administrativeAdjustment: adminAdjustmentEn,
    initiativeAgreement: initiativeAgreementEn,
    notionalTransfer: notionalTransferEn,
    otherUses: otherUsesEn,
    finalSupplyEquipment: finalSupplyEquipmentEn,
    fse: finalSupplyEquipmentEn,
    fuelSupply: fuelSupplyEn,
    fuelExport: fuelExportEn,
    dashboard: dashboardEn,
    allocationAgreement: allocationAgreementEn,
    notifications: notificationsEn,
    creditMarket: creditMarketEn,
    chargingEquipment: chargingEquipmentEn,
    chargingSite: chargingSiteEn,
    bulletins: bulletinEn
  }
} as const

i18n.use(initReactI18next).init({
  resources,
  defaultNS: 'common',
  lng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
