export const getStatus = ({ data }) => {
  switch (data.transactionType.type) {
    case 'Transfer':
      return data.transferHistoryRecord.transferStatus.status
    case 'Issuance':
      return data.issuanceHistoryRecord.issuanceStatus.status
    case 'Assessment':
      return ''
    case 'Initiative Agreement':
      return ''
    default:
      break
  }
}
