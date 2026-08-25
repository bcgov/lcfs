import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DAAssignedAnalystCell } from '../DAAssignedAnalystCell'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let mockRoleNames = [roles.government, roles.ia_manager]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: (...names) => names.every((n) => mockRoleNames.includes(n))
  })
}))

const mockMutate = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useInitiativeAgreementAnalysts: () => ({
    data: [
      {
        userProfileId: 7,
        firstName: 'Erin',
        lastName: 'Fong',
        initials: 'EF',
        fullName: 'Erin Fong'
      }
    ]
  }),
  useAssignDesignatedActionAnalyst: () => ({
    mutate: mockMutate,
    isPending: false
  })
}))

const row = {
  designatedActionId: 9,
  assignedAnalyst: null
}

describe('DAAssignedAnalystCell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoleNames = [roles.government, roles.ia_manager]
  })

  it('lets an IA manager assign an analyst from the cell', () => {
    render(<DAAssignedAnalystCell data={row} />, { wrapper })

    const select = screen.getByTestId('da-analyst-select')
    fireEvent.mouseDown(select.querySelector('[role="combobox"]') || select)
    fireEvent.click(screen.getByText('Erin Fong'))

    expect(mockMutate).toHaveBeenCalledWith(7)
  })

  it('shows a read-only chip to an IA analyst', () => {
    mockRoleNames = [roles.government, roles.ia_analyst]
    render(
      <DAAssignedAnalystCell
        data={{
          ...row,
          assignedAnalyst: { firstName: 'Erin', lastName: 'Fong' }
        }}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('da-analyst-readonly')).toBeInTheDocument()
    expect(screen.queryByTestId('da-analyst-select')).not.toBeInTheDocument()
    expect(screen.getByText('EF')).toBeInTheDocument()
  })
})
