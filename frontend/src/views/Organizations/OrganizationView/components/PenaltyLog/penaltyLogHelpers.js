import { normalizeYear } from '@/utils/helper'

const processDiscretionaryData = (rawPenaltyLogs, yearLabels) => {
  const sums = new Map()
  rawPenaltyLogs.forEach((entry) => {
    const key = normalizeYear(entry?.complianceYear)
    const amount = Number(entry?.penaltyAmount ?? 0)
    sums.set(key, (sums.get(key) ?? 0) + amount)
  })

  return yearLabels.map((year) => sums.get(year) ?? 0)
}

const defaultTranslate = (key) => key

export const processSparklineData = (
  rawPenaltyLogs,
  yearLabels,
  yearlyPenalties
) => {
  const discretionary = processDiscretionaryData(rawPenaltyLogs, yearLabels)
  const automatic = yearlyPenalties.map((item) => item.totalAutomatic)
  return {
    total: automatic.map((amount, index) => amount + discretionary[index]),
    automatic,
    discretionary
  }
}

export const buildAutomaticPenaltyRows = (
  yearlyPenalties,
  t = defaultTranslate
) =>
  yearlyPenalties.flatMap((item) => {
    const dueDate =
      item.reportStatus === 'Assessed' && item.assessedDate
        ? String(item.assessedDate).split('T')[0]
        : ''
    const rows = []
    const autoRenewable = Number(item.autoRenewable ?? 0)
    const autoLowCarbon = Number(item.autoLowCarbon ?? 0)

    if (autoRenewable > 0) {
      rows.push({
        id: `automatic-renewable-${item.compliancePeriodId}`,
        penaltyLogId: `automatic-renewable-${item.compliancePeriodId}`,
        complianceYear: item.complianceYear,
        description: t('org:penaltyLog.automaticDescriptions.renewable'),
        penaltyAmount: autoRenewable,
        dueDate,
        invoiceSent: item.renewableInvoiceSent ?? null,
        paymentReceived: item.renewablePaymentReceived ?? null,
        source: 'automatic'
      })
    }

    if (autoLowCarbon > 0) {
      rows.push({
        id: `automatic-low-carbon-${item.compliancePeriodId}`,
        penaltyLogId: `automatic-low-carbon-${item.compliancePeriodId}`,
        complianceYear: item.complianceYear,
        description: t('org:penaltyLog.automaticDescriptions.lowCarbon'),
        penaltyAmount: autoLowCarbon,
        dueDate,
        invoiceSent: item.lowCarbonInvoiceSent ?? null,
        paymentReceived: item.lowCarbonPaymentReceived ?? null,
        source: 'automatic'
      })
    }

    return rows
  })
