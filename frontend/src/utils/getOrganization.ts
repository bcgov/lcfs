interface OrganizationName {
  name: string
}

type TransferOrganizationHistory<Direction extends string> =
  ('to' extends Direction ? { toOrganization: OrganizationName } : {}) &
    ('from' extends Direction ? { fromOrganization: OrganizationName } : {})

type IssuanceOrganizationHistory<Direction extends string> =
  'to' extends Direction
    ? { issuanceHistoryRecord: { organization: OrganizationName } }
    : {}

export type TransactionOrganizationData<
  TransactionType extends string,
  Direction extends string
> = {
  transactionType: { type: TransactionType }
} & ('Transfer' extends TransactionType
  ? { transferHistoryRecord: TransferOrganizationHistory<Direction> }
  : {}) &
  ('Issuance' extends TransactionType
    ? IssuanceOrganizationHistory<Direction>
    : {})

interface RuntimeTransactionOrganizationData {
  transactionType: { type: string }
  transferHistoryRecord?: {
    toOrganization?: OrganizationName
    fromOrganization?: OrganizationName
  }
  issuanceHistoryRecord?: { organization?: OrganizationName }
}

interface RuntimeTransactionOrganizationParams {
  data: RuntimeTransactionOrganizationData
}

export function getOrganization<
  TransactionType extends string,
  Direction extends string
>(
  params: {
    data: TransactionOrganizationData<TransactionType, Direction>
  },
  type: Direction
): string | undefined
export function getOrganization(
  { data }: RuntimeTransactionOrganizationParams,
  type: string
): string | undefined {
  switch (data.transactionType.type) {
    case 'Transfer':
      if (type === 'to') {
        return data.transferHistoryRecord?.toOrganization?.name
      }
      if (type === 'from') {
        return data.transferHistoryRecord?.fromOrganization?.name
      }
      break
    case 'Issuance':
      if (type === 'to') {
        return data.issuanceHistoryRecord?.organization?.name
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
