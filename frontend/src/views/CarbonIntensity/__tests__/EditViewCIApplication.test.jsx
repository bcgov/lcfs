import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'

// ---------------- Mocks ----------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true, initialized: true, token: 'test' }
  })
}))

let mockUserRoles = [{ name: roles.ci_applicant }]
let mockCurrentUser = {
  data: {
    roles: mockUserRoles,
    organization: {
      organizationId: 1,
      name: 'Fuel Producer Ltd.',
      operatingName: 'Fuel Producer',
      email: 'hello@example.com',
      phone: '+1 555 0100'
    }
  }
}
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser
}))

const mockNavigate = vi.fn()
let mockParams = {}
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams
  }
})

let mockGetCIApplication = {
  data: undefined,
  isLoading: false
}
const mockCreate = vi.fn().mockResolvedValue({ ciApplicationId: 99 })
const mockUpdate = vi.fn().mockResolvedValue({ ciApplicationId: 99 })
const mockDelete = vi.fn().mockResolvedValue(undefined)
const mockOptions = {
  data: {
    statuses: [],
    unitsOfMeasure: [{ uomId: 1, name: 'Litres' }]
  },
  isLoading: false
}

vi.mock('@/hooks/useCIApplication', () => ({
  useGetCIApplication: vi.fn(() => mockGetCIApplication),
  useCIApplicationOptions: vi.fn(() => mockOptions),
  useCreateCIApplication: vi.fn(() => ({
    mutateAsync: mockCreate,
    isPending: false
  })),
  useUpdateCIApplicationStep1: vi.fn(() => ({
    mutateAsync: mockUpdate,
    isPending: false
  })),
  useDeleteCIApplication: vi.fn(() => ({
    mutateAsync: mockDelete,
    isPending: false
  }))
}))

// Stub the heavy step component so we can drive its props directly.
vi.mock(
  '@/views/CarbonIntensity/components/ApplicationInformationStep',
  () => ({
    ApplicationInformationStep: ({ onSave, onDelete, organization }) => (
      <div data-test="step1-stub">
        <div data-test="org-name">{organization?.name || ''}</div>
        <button
          data-test="step1-save-trigger"
          onClick={() =>
            onSave({
              facilityCountry: 'Argentina',
              facilityNameplateCapacity: 1000,
              facilityNameplateCapacityUnitId: 1
            })
          }
        >
          save
        </button>
        {onDelete && (
          <button data-test="step1-delete-trigger" onClick={onDelete}>
            delete
          </button>
        )}
      </div>
    )
  })
)

vi.mock('@/views/CarbonIntensity/components/StepStub', () => ({
  StepStub: ({ titleKey }) => <div data-test={`stub-${titleKey}`} />,
  default: ({ titleKey }) => <div data-test={`stub-${titleKey}`} />
}))

// Import AFTER mocks
import { EditViewCIApplication } from '@/views/CarbonIntensity/EditViewCIApplication'

// ---------------- Tests ----------------

describe('EditViewCIApplication', () => {
  beforeAll(() => {
    // jsdom logs "Not implemented: window.scrollTo" — stub it so the
    // smooth-scroll on step transitions stays out of the test output.
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRoles = [{ name: roles.ci_applicant }]
    mockCurrentUser = {
      data: {
        roles: mockUserRoles,
        organization: {
          organizationId: 1,
          name: 'Fuel Producer Ltd.',
          operatingName: 'Fuel Producer',
          email: 'hello@example.com',
          phone: '+1 555 0100'
        }
      }
    }
    mockParams = {}
    mockGetCIApplication = { data: undefined, isLoading: false }
  })
  afterEach(cleanup)

  it('renders all five accordion steps in add mode', async () => {
    render(<EditViewCIApplication />, { wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('ci-step-accordion-step1')).toBeInTheDocument()
      expect(screen.getByTestId('ci-step-accordion-step2')).toBeInTheDocument()
      expect(screen.getByTestId('ci-step-accordion-step3')).toBeInTheDocument()
      expect(screen.getByTestId('ci-step-accordion-step4')).toBeInTheDocument()
      expect(screen.getByTestId('ci-step-accordion-step5')).toBeInTheDocument()
    })
  })

  it('passes organization info from current user into Step 1 in add mode', async () => {
    render(<EditViewCIApplication />, { wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('org-name').textContent).toBe(
        'Fuel Producer Ltd.'
      )
    })
  })

  it('shows status badge when editing an existing application', async () => {
    mockParams = { ciApplicationId: '10' }
    mockGetCIApplication = {
      data: {
        ciApplicationId: 10,
        organization: { name: 'Acme Corp' },
        status: { status: 'Draft' }
      },
      isLoading: false
    }
    render(<EditViewCIApplication />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText(/Status: Draft/)).toBeInTheDocument()
    })
  })

  it('creates a new draft and navigates to the edit URL on Save (add mode)', async () => {
    render(<EditViewCIApplication />, { wrapper })

    fireEvent.click(await screen.findByTestId('step1-save-trigger'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith(
      ROUTES.CI_APPLICATIONS.EDIT.replace(':ciApplicationId', '99'),
      { replace: true }
    )
  })

  it('updates Step 1 (no navigate) when editing an existing application', async () => {
    mockParams = { ciApplicationId: '10' }
    mockGetCIApplication = {
      data: {
        ciApplicationId: 10,
        organization: { name: 'Acme Corp' },
        status: { status: 'Draft' }
      },
      isLoading: false
    }

    render(<EditViewCIApplication />, { wrapper })
    fireEvent.click(await screen.findByTestId('step1-save-trigger'))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows the loader while options are loading', async () => {
    // Re-apply the mock with isLoading: true
    const useCIApplicationModule = await import('@/hooks/useCIApplication')
    useCIApplicationModule.useCIApplicationOptions.mockReturnValueOnce({
      data: undefined,
      isLoading: true
    })
    const { container } = render(<EditViewCIApplication />, { wrapper })
    // Loading component is rendered — accordion should NOT be present
    await waitFor(() => {
      expect(
        container.querySelector('[data-test="ci-step-accordion-step1"]')
      ).toBeNull()
    })
  })

  it('opens delete confirmation modal when Delete is clicked', async () => {
    mockParams = { ciApplicationId: '10' }
    mockGetCIApplication = {
      data: {
        ciApplicationId: 10,
        organization: { name: 'Acme Corp' },
        status: { status: 'Draft' }
      },
      isLoading: false
    }

    render(<EditViewCIApplication />, { wrapper })
    fireEvent.click(await screen.findByTestId('step1-delete-trigger'))

    // BCModal renders dialog content from the modal data — confirmation copy
    // is the deleteConfirmText i18n key we pass in.
    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step1.deleteConfirmText')
      ).toBeInTheDocument()
    })
    // Confirming triggers the delete mutation and a navigate to the list page.
    const confirmBtn = screen.getByText('common:deleteBtn')
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('10'))
    expect(mockNavigate).toHaveBeenCalledWith(
      ROUTES.CI_APPLICATIONS.LIST,
      expect.any(Object)
    )
  })
})
