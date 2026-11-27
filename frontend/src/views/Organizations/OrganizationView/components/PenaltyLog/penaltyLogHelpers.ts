import { normalizeYear } from '@/utils/helper'

type YearValue = string | number
type PenaltyLog = {
  complianceYear?: YearValue | null
  penaltyAmount?: number | string | null
}
type YearlyPenalty = {
  compliancePeriodId: string | number
  complianceYear: YearValue
  totalAutomatic: number
  autoRenewable?: number | string | null
  autoLowCarbon?: number | string | null
  reportStatus?: string | null
  assessedDate?: string | null
  renewableInvoiceSent?: string | null
  renewablePaymentReceived?: string | null
  lowCarbonInvoiceSent?: string | null
  lowCarbonPaymentReceived?: string | null
}
type AutomaticPenaltyRow = {
  id: string
  penaltyLogId: string
  complianceYear: YearValue
  description: string
  penaltyAmount: number
  dueDate: string
  invoiceSent: string | null
  paymentReceived: string | null
  source: 'automatic'
}

const processDiscretionaryData = (
  rawPenaltyLogs: PenaltyLog[],
  yearLabels: string[]
) => {
  const sums = new Map<string, number>()
  rawPenaltyLogs.forEach((entry) => {
    const key = normalizeYear(entry?.complianceYear)
    const amount = Number(entry?.penaltyAmount ?? 0)
    sums.set(key, (sums.get(key) ?? 0) + amount)
  })

  return yearLabels.map((year) => sums.get(year) ?? 0)
}

const defaultTranslate = (key: string) => key

export const processSparklineData = (
  rawPenaltyLogs: PenaltyLog[],
  yearLabels: string[],
  yearlyPenalties: YearlyPenalty[]
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
  yearlyPenalties: YearlyPenalty[],
  t: (key: string) => string = defaultTranslate
): AutomaticPenaltyRow[] =>
  yearlyPenalties.flatMap((item) => {
    const dueDate =
      item.reportStatus === 'Assessed' && item.assessedDate
        ? String(item.assessedDate).split('T')[0]
        : ''
    const rows: AutomaticPenaltyRow[] = []
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
