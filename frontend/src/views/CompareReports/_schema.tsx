import type { CompareReportColumn } from '@/types/schema'

export const renewableFuelColumns = (
  t: (key: string) => string,
  report1Label: string,
  report2Label: string
): CompareReportColumn[] => [
  {
    id: 'line',
    label: t('report:summaryLabels.line'),
    align: 'center',
    width: '100px',
    bold: true
  },
  {
    id: 'description',
    label: t('report:renewableFuelTargetSummary'),
    maxWidth: '300px'
  },
  {
    id: 'report1',
    label: report1Label,
    align: 'right',
    width: '150px'
  },
  {
    id: 'report2',
    label: report2Label,
    align: 'right',
    width: '150px'
  },
  {
    id: 'delta',
    label: t('report:delta'),
    align: 'right',
    width: '150px'
  }
]

export const lowCarbonColumns = (
  t: (key: string) => string,
  report1Label: string,
  report2Label: string
): CompareReportColumn[] => [
  {
    id: 'line',
    label: t('report:summaryLabels.line'),
    align: 'center',
    width: '100px',
    bold: true
  },
  {
    id: 'description',
    label: t('report:lowCarbonFuelTargetSummary'),
    maxWidth: '300px'
  },
  {
    id: 'report1',
    label: report1Label,
    align: 'right',
    width: '150px'
  },
  {
    id: 'report2',
    label: report2Label,
    align: 'right',
    width: '150px'
  },
  {
    id: 'delta',
    label: t('report:delta'),
    align: 'right',
    width: '150px'
  }
]

export const nonCompliancePenaltyColumns = (
  t: (key: string) => string,
  report1Label: string,
  report2Label: string
): CompareReportColumn[] => [
  {
    id: 'line',
    label: t('report:summaryLabels.line'),
    align: 'center',
    width: '100px',
    bold: true
  },
  {
    id: 'description',
    label: t('report:nonCompliancePenaltySummary'),
    maxWidth: '300px'
  },
  {
    id: 'report1',
    label: report1Label,
    align: 'right',
    width: '150px'
  },
  {
    id: 'report2',
    label: report2Label,
    align: 'right',
    width: '150px'
  },
  {
    id: 'delta',
    label: t('report:delta'),
    align: 'right',
    width: '150px'
  }
]
