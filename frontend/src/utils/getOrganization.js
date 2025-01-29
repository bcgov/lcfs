export const getOrganization = ({ data }, type) => {
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
