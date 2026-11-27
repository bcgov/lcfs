import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { CreditLedger, type CreditLedgerProps } from '../CreditLedger'
import { roles, type RoleName } from '@/constants/roles'

const mockCurrentUser = vi.hoisted(() =>
  vi.fn<
    () => {
      isLoading: boolean
      hasRoles: (...names: RoleName[]) => boolean
    }
  >()
)

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: mockCurrentUser
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading" />
}))

vi.mock('../CreditLedgerLegacy', () => ({
  CreditLedgerLegacy: ({ organizationId }: CreditLedgerProps) => (
    <div data-test="legacy-ledger">{organizationId}</div>
  )
}))

vi.mock('../CreditLedgerPeriod', () => ({
  CreditLedgerPeriod: ({ organizationId }: CreditLedgerProps) => (
    <div data-test="period-ledger">{organizationId}</div>
  )
}))

const setUser = ({
  userRoles = [],
  isLoading = false
}: { userRoles?: RoleName[]; isLoading?: boolean } = {}) => {
  mockCurrentUser.mockReturnValue({
    isLoading,
    hasRoles: (...names) => names.every((name) => userRoles.includes(name))
  })
}

describe('CreditLedger (IDIR/BCeID split)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the compliance-period ledger for government users', () => {
    setUser({ userRoles: [roles.government] })
    render(<CreditLedger organizationId={5} />)

    expect(screen.getByTestId('period-ledger')).toHaveTextContent('5')
    expect(screen.queryByTestId('legacy-ledger')).not.toBeInTheDocument()
  })

  it('renders the legacy ledger for supplier users', () => {
    setUser({ userRoles: [roles.supplier] })
    render(<CreditLedger organizationId={5} />)

    expect(screen.getByTestId('legacy-ledger')).toHaveTextContent('5')
    expect(screen.queryByTestId('period-ledger')).not.toBeInTheDocument()
  })

  it('shows a loader instead of guessing while the user is loading', () => {
    setUser({ isLoading: true })
    render(<CreditLedger />)

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-ledger')).not.toBeInTheDocument()
    expect(screen.queryByTestId('period-ledger')).not.toBeInTheDocument()
  })
})
