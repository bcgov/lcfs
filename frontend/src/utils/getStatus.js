export const getStatus = ({ data }) => {
  switch (data.transaction_type.type) {
    case 'Transfer':
      return data.transfer_history_record.transfer_status.status
    case 'Issuance':
      return data.issuance_history_record.issuance_status.status
    case 'Assessment':
      return ''
    case 'Initiative Agreement':
      return ''
    default:
      break
  }
}
