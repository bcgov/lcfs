interface TransactionHistoryData {
  transactionType: { type: string }
  transferHistoryRecord: { transferStatus: { status: string } }
  issuanceHistoryRecord: { issuanceStatus: { status: string } }
}

interface TransactionHistoryParams {
  data: TransactionHistoryData
}

export const getStatus = ({
  data
}: TransactionHistoryParams): string | undefined => {
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
