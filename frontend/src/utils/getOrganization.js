export const getOrganization = ({ data }, type) => {
  switch (data.transaction_type.type) {
    case 'Transfer':
      if (type === 'to') {
        return data.transfer_history_record.to_organization.name
      }
      if (type === 'from') {
        return data.transfer_history_record.from_organization.name
      }
      break
    case 'Issuance':
      if (type === 'to') {
        return data.issuance_history_record.organization.name
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
