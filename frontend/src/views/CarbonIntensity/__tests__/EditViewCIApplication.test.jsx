import React from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
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
  useCurrentUser: () => ({
    ...mockCurrentUser,
    hasRoles: vi.fn(() => false),
    hasAnyRole: vi.fn(() => false)
  })
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
    unitsOfMeasure: ['L']
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
  useUpdateCIApplicationStep2: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ciApplicationId: 99 }),
    isPending: false
  })),
  useUpdateCIApplicationStep3: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ciApplicationId: 99 }),
    isPending: false
  })),
  useSubmitCIApplication: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ciApplicationId: 99 }),
    isPending: false
  })),
  useGenerateCIApplicationFuelCodes: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ciApplicationId: 99 }),
    isPending: false
  })),
  useRecordCIDecision: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ciApplicationId: 99 }),
    isPending: false
  })),
  useGetCIComments: vi.fn(() => ({ data: [], isLoading: false })),
  useAddCIComment: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(null),
    isPending: false
  })),
  useDeleteCIApplication: vi.fn(() => ({
    mutateAsync: mockDelete,
    isPending: false
  }))
}))

vi.mock('@/views/CarbonIntensity/components/DocumentsModellingStep', () => ({
  DocumentsModellingStep: () => <div data-test="step3-stub" />,
  DOC_CATEGORY_TECHNICAL_REPORT: 'technical_report',
  DOC_CATEGORY_GHGENIUS_MODEL: 'ghgenius_model',
  DOC_CATEGORY_SUPPORTING: 'supporting'
}))

vi.mock('@/views/CarbonIntensity/components/SignAndSubmitStep', () => ({
  SignAndSubmitStep: () => <div data-test="step4-stub" />
}))

vi.mock('@/views/CarbonIntensity/components/GovernmentDecisionStep', () => ({
  GovernmentDecisionStep: () => <div data-test="step5-stub" />
}))

vi.mock('@/views/CarbonIntensity/components/ProposedFuelPathwaysStep', () => ({
  ProposedFuelPathwaysStep: ({ readOnly }) => (
    <div data-test="step2-stub" data-read-only={String(readOnly)} />
  )
}))

vi.mock('@/views/CarbonIntensity/components/ApplicationSummary', () => ({
  ApplicationSummary: ({ canEditPathways }) => {
    const [editing, setEditing] = React.useState(false)
    return (
      <div data-test="summary-stub">
        {canEditPathways && (
          <button
            data-test="summary-pathways-edit"
            onClick={() => setEditing(true)}
          >
            edit pathways
          </button>
        )}
        {editing && <div data-test="step2-stub" data-read-only="false" />}
      </div>
    )
  }
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
              facilityNameplateCapacityUnit: 'L'
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
    // The wrapper uses BrowserRouter, so `?step=N` written by a prior test's
    // navigation lingers on the shared jsdom URL. Reset it so each test starts
    // without an explicit step param (mirrors opening a draft afresh).
    window.history.pushState({}, '', '/')
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

  it('resumes a draft on the first incomplete step (Steps 1–2 saved -> Step 3)', async () => {
    mockParams = { ciApplicationId: '10' }
    mockGetCIApplication = {
      data: {
        ciApplicationId: 10,
        organization: { name: 'Acme Corp' },
        status: { status: 'Draft' },
        // Step 1 required fields saved
        facilityCountry: 'Canada',
        facilityCity: 'Vancouver',
        facilityProvinceState: 'BC',
        facilityNameplateCapacity: 1000,
        facilityNameplateCapacityUnit: 'L',
        // Step 2 saved
        pathways: [{ pathwayId: 1 }],
        // Step 3 not yet complete (no documents)
        documents: []
      },
      isLoading: false
    }

    render(<EditViewCIApplication />, { wrapper })

    await waitFor(() => {
      // Step 3 accordion is expanded; Steps 1 and 2 are collapsed.
      expect(screen.getByTestId('ci-step-accordion-step3')).toHaveClass(
        'Mui-expanded'
      )
    })
    expect(screen.getByTestId('ci-step-accordion-step1')).not.toHaveClass(
      'Mui-expanded'
    )
    expect(screen.getByTestId('ci-step-accordion-step2')).not.toHaveClass(
      'Mui-expanded'
    )
  })

  it('opens a brand-new draft (nothing saved) on Step 1', async () => {
    mockParams = { ciApplicationId: '10' }
    mockGetCIApplication = {
      data: {
        ciApplicationId: 10,
        organization: { name: 'Acme Corp' },
        status: { status: 'Draft' },
        pathways: [],
        documents: []
      },
      isLoading: false
    }

    render(<EditViewCIApplication />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('ci-step-accordion-step1')).toHaveClass(
        'Mui-expanded'
      )
    })
    expect(screen.getByTestId('ci-step-accordion-step3')).not.toHaveClass(
      'Mui-expanded'
    )
  })

  it('enables supplemental pathway editing for a requested Submitted application', async () => {
    mockParams = { ciApplicationId: '10' }
    mockGetCIApplication = {
      data: {
        ciApplicationId: 10,
        organization: { name: 'Acme Corp' },
        status: { status: 'Submitted' },
        pathwaySupplementalEditEnabled: true,
        pathwayChangesRequestedAt: '2026-06-10T10:00:00Z',
        pathways: []
      },
      isLoading: false
    }

    render(<EditViewCIApplication />, { wrapper })

    fireEvent.click(await screen.findByTestId('summary-pathways-edit'))
    await waitFor(() => {
      expect(screen.getByTestId('step2-stub')).toHaveAttribute(
        'data-read-only',
        'false'
      )
    })
  })
})
