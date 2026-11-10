interface TransactionHistoryData {
  transactionType: { type: string }
  transferHistoryRecord: {
    toOrganization: { name: string }
    fromOrganization: { name: string }
  }
  issuanceHistoryRecord: { organization: { name: string } }
}

interface TransactionHistoryParams {
  data: TransactionHistoryData
}

export const getOrganization = (
  { data }: TransactionHistoryParams,
  type: string
): string | undefined => {
  switch (data.transactionType.type) {
    case 'Transfer':
      if (type === 'to') {
        return data.transferHistoryRecord.toOrganization.name
      }
      if (type === 'from') {
        return data.transferHistoryRecord.fromOrganization.name
      }
      break
    case 'Issuance':
      if (type === 'to') {
        return data.issuanceHistoryRecord.organization.name
      }
      if (type === 'from') {
        return 'BC Gov'
      }
      break
    case 'Assessment':
      return ''
    case 'Initiative Agreement':
      return ''
    default:
      break
  }
}
