interface TransferStatusHistory {
  transferStatus: { status: string }
}

interface IssuanceStatusHistory {
  issuanceStatus: { status: string }
}

export type TransactionStatusData<TransactionType extends string> = {
  transactionType: { type: TransactionType }
} & ('Transfer' extends TransactionType
  ? { transferHistoryRecord: TransferStatusHistory }
  : {}) &
  ('Issuance' extends TransactionType
    ? { issuanceHistoryRecord: IssuanceStatusHistory }
    : {})

interface RuntimeTransactionStatusData {
  transactionType: { type: string }
  transferHistoryRecord?: TransferStatusHistory
  issuanceHistoryRecord?: IssuanceStatusHistory
}

interface RuntimeTransactionStatusParams {
  data: RuntimeTransactionStatusData
}

export function getStatus<T extends string>(params: {
  data: TransactionStatusData<T>
}): string | undefined
export function getStatus({
  data
}: RuntimeTransactionStatusParams): string | undefined {
  switch (data.transactionType.type) {
    case 'Transfer':
      return data.transferHistoryRecord!.transferStatus.status
    case 'Issuance':
      return data.issuanceHistoryRecord!.issuanceStatus.status
    case 'Assessment':
      return ''
    case 'Initiative Agreement':
      return ''
    default:
      break
  }
}
