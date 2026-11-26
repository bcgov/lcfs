import 'react'
import { describe, expect, vi, beforeEach } from 'vite-plus/test'
import { fireEvent, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { InitiativeAgreementDetail } from '../InitiativeAgreementDetail'
import { useInitiativeAgreementPageStore } from '@/stores/useInitiativeAgreementPageStore'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock-token', authenticated: true, initialized: true }
  })
}))

let mockRoles = [{ name: roles.ia_analyst }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles },
    hasRoles: (...names) =>
      names.some((n) => mockRoles.some((r) => r.name === n)),
    hasAnyRole: (...names) =>
      names.some((n) => mockRoles.some((r) => r.name === n))
  })
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useParams: () => ({ initiativeAgreementId: '5' }) }
})

const mockAgreement = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useGetInitiativeAgreement: () => mockAgreement(),
  useInitiativeAgreementDocumentRestoreTargets: () => ({
    data: [
      { designatedActionId: 17, actionNumber: 3 },
      { designatedActionId: 18, actionNumber: 4 }
    ],
    isError: false
  }),
  useUpdateAgreement: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeOrders: () => ({ data: [] }),
  useRecordVersions: () => ({ data: [], isLoading: false }),
  useStartChangeOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useAcceptChangeOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useDiscardChangeOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useSetAgreementUnderway: () => ({ mutateAsync: vi.fn() })
}))

const mockDocuments = vi.fn()
const documentsArgs = vi.fn()
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: (...args) => {
    documentsArgs(...args)
    return mockDocuments()
  },
  useDownloadDocument: () => vi.fn(),
  // The document list's preview button (from develop) fetches through this.
  useFetchDocument: () => vi.fn()
}))

const commentsProps = vi.fn()
vi.mock('@/components/Comments', () => ({
  default: (props) => {
    commentsProps(props)
    return <div data-test="comments-component" />
  }
}))

vi.mock('../components/AddDesignatedAction', () => ({
  AddDesignatedAction: ({ canAdd }) =>
    canAdd ? <div data-test="add-designated-action" /> : null
}))

vi.mock('../components/DeletedItems', () => ({
  DeletedItems: ({ parentID, heading }) => (
    <div data-test="deleted-items-for-action" data-parent-id={parentID}>
      {heading}
    </div>
  )
}))

vi.mock('../components/NotesAccordion', () => ({
  NotesAccordion: ({ initiativeAgreementId, readOnly }) => (
    <div
      data-test="notes-accordion"
      data-agreement-id={initiativeAgreementId}
      data-read-only={String(!!readOnly)}
    />
  )
}))

const daGridProps = vi.fn()
vi.mock('../components/DesignatedActionsGrid', () => ({
  DesignatedActionsGrid: (props) => {
    daGridProps(props)
    return <div data-test="designated-actions-grid" />
  }
}))

vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: ({ open, deleteToBin }) =>
    open ? (
      <div
        data-test="upload-dialog"
        data-delete-to-bin={String(!!deleteToBin)}
      />
    ) : null
}))

const treeProps = vi.fn()
vi.mock('../components/DocumentTree', () => ({
  // The tree owns the section's card and header, so the page's own
  // controls reach the screen through it.
  DocumentTree: (props) => {
    treeProps(props)
    return (
      <div data-test="document-tree">
        <span>{props.title}</span>
        {props.headerAction}
      </div>
    )
  }
}))

const agreement = {
  initiativeAgreementId: 5,
  iaCode: 'IA-26ORG1',
  title: 'Renewable Fuels Production Facility',
  projectDescription: 'A description of the project.',
  agreementStartDate: '2026-06-19',
  agreementEndDate: '2027-05-03',
  // A package still open to edits (#5554); lockedAgreement below is the
  // same agreement once it is Underway.
  lifecycleStatus: { status: 'Draft' },
  packageEditable: true,
  organization: {
    organizationId: 1,
    name: 'Test Organization',
    phone: '604-555-0100',
    email: 'contact@example.com',
    orgAddress: {
      streetAddress: '697 Burrard Street',
      city: 'Vancouver',
      provinceState: 'BC',
      country: 'Canada',
      postalcodeZipcode: 'V6G 2P3'
    }
  }
}

const lockedAgreement = {
  ...agreement,
  lifecycleStatus: { status: 'Underway' },
  packageEditable: false
}

describe('InitiativeAgreementDetail', () => {
  beforeEach(() => {
    mockRoles = [{ name: roles.ia_analyst }]
    mockAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      isError: false,
      error: null
    })
    mockDocuments.mockReturnValue({ data: [], refetch: vi.fn() })
  })

  test('renders the agreement card with organization, status and dates', ({
    render,
    app
  }) => {
    render(<InitiativeAgreementDetail />, app)

    expect(
      screen.getByTestId('initiative-agreement-detail-title')
    ).toHaveTextContent('IA-26ORG1')
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByTestId('agreement-status-chip')).toHaveTextContent(
      'Draft'
    )
    expect(screen.getByText(/697 Burrard Street/)).toBeInTheDocument()
    expect(screen.getByText('604-555-0100')).toBeInTheDocument()
    expect(screen.getByText('IA5')).toBeInTheDocument()
  })

  test('renders the agreement brief', ({ render, app }) => {
    render(<InitiativeAgreementDetail />, app)
    expect(
      screen.getByText('Renewable Fuels Production Facility')
    ).toBeInTheDocument()
    expect(
      screen.getByText('A description of the project.')
    ).toBeInTheDocument()
  })

  test('offers document upload to an IA analyst', ({ render, app }) => {
    render(<InitiativeAgreementDetail />, app)
    expect(screen.getByTestId('upload-documents-button')).toBeInTheDocument()
  })

  test('shows designated-action restore bins to the agreement proponent', ({
    render,
    app
  }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    mockAgreement.mockReturnValue({
      data: {
        ...agreement
      },
      isLoading: false,
      isError: false,
      error: null
    })

    render(<InitiativeAgreementDetail />, app)

    const bins = screen.getAllByTestId('deleted-items-for-action')
    expect(bins).toHaveLength(2)
    expect(bins[0]).toHaveAttribute('data-parent-id', '17')
    expect(bins[0]).toHaveTextContent(
      'initiativeAgreement:detail.actionDeletedItems'
    )
  })

  test('offers Edit in the card header to analysts, not proponents', ({
    render,
    app
  }) => {
    const { unmount } = render(<InitiativeAgreementDetail />, app)
    expect(screen.getByTestId('edit-agreement')).toBeInTheDocument()
    unmount()

    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)
    expect(screen.queryByTestId('edit-agreement')).not.toBeInTheDocument()
  })

  test('not offered to a director', ({ render, app }) => {
    mockRoles = [{ name: roles.director }]
    render(<InitiativeAgreementDetail />, app)
    expect(screen.queryByTestId('edit-agreement')).not.toBeInTheDocument()
  })

  test('Edit switches the card into edit mode and Cancel returns', ({
    render,
    app
  }) => {
    render(<InitiativeAgreementDetail />, app)
    expect(screen.queryByTestId('agreement-edit-form')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('edit-agreement'))

    expect(screen.getByTestId('agreement-edit-form')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-agreement')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('initiative-agreement-brief-section')
    ).not.toBeInTheDocument()
    // The rest of the page stays available while editing.
    expect(screen.getByTestId('designated-actions-grid')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('cancel-agreement-edit'))

    expect(screen.queryByTestId('agreement-edit-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('edit-agreement')).toBeInTheDocument()
  })

  test('does not offer document upload to a BCeID proponent', ({
    render,
    app
  }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)
    expect(
      screen.queryByTestId('upload-documents-button')
    ).not.toBeInTheDocument()
  })

  test('renders an empty state when the agreement has no documents', ({
    render,
    app
  }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)
    expect(
      screen.getByText('initiativeAgreement:detail.noDocuments')
    ).toBeInTheDocument()
  })

  test('surfaces a load failure instead of a blank card', ({ render, app }) => {
    mockAgreement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'boom' }
    })
    render(<InitiativeAgreementDetail />, app)
    expect(screen.getByTestId('alert-box')).toHaveTextContent('boom')
  })

  test('renders document rows with size and uploading organization code', ({
    render,
    app
  }) => {
    mockDocuments.mockReturnValue({
      data: [
        {
          documentId: 9,
          fileName: 'signed-agreement.pdf',
          fileSize: 1000000,
          createDate: '2026-06-01T00:00:00Z',
          createUser: 'LCFS1_bat',
          uploadingOrganizationCode: 'BETZ'
        },
        {
          documentId: 10,
          fileName: 'award-letter.pdf',
          fileSize: 2048,
          createDate: '2026-06-02T00:00:00Z',
          createUser: 'IDIRSTAFF',
          uploadingOrganizationCode: null
        }
      ],
      refetch: vi.fn()
    })
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)

    expect(screen.getByText('signed-agreement.pdf')).toBeInTheDocument()
    expect(screen.getByText(/1 MB/)).toBeInTheDocument()
    expect(screen.getByText(/BETZ/)).toBeInTheDocument()
    // Government upload falls back to the government label.
    expect(screen.getByText(/gov/)).toBeInTheDocument()
  })

  test.for([roles.ia_analyst, roles.ia_manager, roles.director])(
    'gives %s the folder tree the designated action page uses (#5337)',
    (role, { render, app }) => {
      mockRoles = [{ name: role }]
      render(<InitiativeAgreementDetail />, app)

      expect(screen.getByTestId('document-tree')).toBeInTheDocument()
      expect(treeProps).toHaveBeenLastCalledWith(
        expect.objectContaining({
          parentType: 'initiativeAgreement',
          parentID: '5',
          allowSubfolders: true,
          enablePreview: true,
          title: 'initiativeAgreement:detail.documents'
        })
      )
      // The tree replaces the flat list, so the list is not fetched too.
      expect(documentsArgs).toHaveBeenLastCalledWith(
        'initiativeAgreement',
        '5',
        { enabled: false }
      )
    }
  )

  test('opens the upload dialog from the tree header', ({ render, app }) => {
    render(<InitiativeAgreementDetail />, app)
    expect(screen.queryByTestId('upload-dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('upload-documents-button'))

    expect(screen.getByTestId('upload-dialog')).toBeInTheDocument()
    // The shared delete route refuses agreements, so the dialog bins files.
    expect(screen.getByTestId('upload-dialog')).toHaveAttribute(
      'data-delete-to-bin',
      'true'
    )
  })

  test('keeps a BCeID proponent on the flat list, without folders', ({
    render,
    app
  }) => {
    // Folder organization is IDIR-only, like the designated action page.
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)

    expect(screen.queryByTestId('document-tree')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreement-documents-section')
    ).toBeInTheDocument()
    expect(documentsArgs).toHaveBeenLastCalledWith('initiativeAgreement', '5', {
      enabled: true
    })
  })

  test('publishes the agreement code to the breadcrumb store', ({
    render,
    app
  }) => {
    render(<InitiativeAgreementDetail />, app)
    expect(useInitiativeAgreementPageStore.getState().agreementCrumb).toBe(
      'IA-26ORG1'
    )
  })

  test('offers to add an action while the package is editable (#5554)', ({
    render,
    app
  }) => {
    render(<InitiativeAgreementDetail />, app)
    expect(screen.getByTestId('add-designated-action')).toBeInTheDocument()
  })

  test('offers Set to Underway to a director on a draft (#5553)', ({
    render,
    app
  }) => {
    mockRoles = [{ name: roles.director }]
    mockAgreement.mockReturnValue({
      data: { ...agreement, lifecycleStatus: { status: 'Draft' } },
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, app)
    expect(screen.getByTestId('set-underway-button')).toBeInTheDocument()
  })

  test.for([
    ['an IA analyst on a draft', roles.ia_analyst, 'Draft'],
    ['an IA manager on a draft', roles.ia_manager, 'Draft'],
    ['a director once underway', roles.director, 'Underway']
  ])(
    'does not offer Set to Underway to %s',
    ([, role, status], { render, app }) => {
      mockRoles = [{ name: role }]
      mockAgreement.mockReturnValue({
        data: {
          ...(status === 'Underway' ? lockedAgreement : agreement),
          lifecycleStatus: { status }
        },
        isLoading: false,
        isError: false,
        error: null
      })
      render(<InitiativeAgreementDetail />, app)
      expect(
        screen.queryByTestId('set-underway-button')
      ).not.toBeInTheDocument()
    }
  )

  test.for(['Underway', 'Completed', 'Terminated'])(
    'does not offer to add an action to a %s agreement',
    (status, { render, app }) => {
      mockAgreement.mockReturnValue({
        data: { ...lockedAgreement, lifecycleStatus: { status } },
        isLoading: false,
        isError: false,
        error: null
      })
      render(<InitiativeAgreementDetail />, app)
      expect(
        screen.queryByTestId('add-designated-action')
      ).not.toBeInTheDocument()
    }
  )

  test('renders the designated actions grid for IDIR IA roles', ({
    render,
    app
  }) => {
    render(<InitiativeAgreementDetail />, app)

    expect(screen.getByTestId('designated-actions-grid')).toBeInTheDocument()
    expect(daGridProps).toHaveBeenCalledWith(
      expect.objectContaining({ initiativeAgreementId: '5' })
    )
  })

  test('hides the designated actions grid from a BCeID proponent', ({
    render,
    app
  }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)

    expect(
      screen.queryByTestId('designated-actions-grid')
    ).not.toBeInTheDocument()
  })

  test('shows the notes accordion to a director', ({ render, app }) => {
    mockRoles = [{ name: roles.director }]
    render(<InitiativeAgreementDetail />, app)

    expect(screen.getByTestId('notes-accordion')).toHaveAttribute(
      'data-agreement-id',
      '5'
    )
  })

  test('hides the notes accordion from a BCeID proponent', ({
    render,
    app
  }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)

    expect(screen.queryByTestId('notes-accordion')).not.toBeInTheDocument()
  })

  test('shows the dual-mode comment thread to IDIR IA roles', ({
    render,
    app
  }) => {
    render(<InitiativeAgreementDetail />, app)

    expect(screen.getByTestId('comments-component')).toBeInTheDocument()
    expect(commentsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'initiativeAgreement',
        entityId: 5,
        commentMode: 'dual'
      })
    )
  })

  test('hides the comment thread from a BCeID proponent', ({ render, app }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, app)

    expect(screen.queryByTestId('comments-component')).not.toBeInTheDocument()
  })

  test('says so when no organization is assigned yet (#5186)', ({
    render,
    app
  }) => {
    mockAgreement.mockReturnValue({
      data: { ...agreement, organization: null },
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, app)
    expect(
      screen.getByText('initiativeAgreement:detail.noOrganization')
    ).toBeInTheDocument()
    expect(screen.getByTestId('agreement-status-chip')).toHaveTextContent(
      'Draft'
    )
  })

  test('tolerates an organization with no address', ({ render, app }) => {
    mockAgreement.mockReturnValue({
      data: {
        ...agreement,
        organization: { organizationId: 1, name: 'Test Organization' }
      },
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, app)
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  describe('once the package is read-only (#5554)', () => {
    beforeEach(() => {
      mockAgreement.mockReturnValue({
        data: lockedAgreement,
        isLoading: false,
        isError: false,
        error: null
      })
    })

    test('says why, naming the status, with no change order action yet', ({
      render,
      app
    }) => {
      render(<InitiativeAgreementDetail />, app)
      const notice = screen.getByTestId('package-lock-notice')
      expect(notice).toHaveTextContent(
        'initiativeAgreement:detail.packageLockedTitle'
      )
      // #5555 fills this slot with "Start change order".
      expect(
        screen.queryByTestId('package-lock-notice-action')
      ).not.toBeInTheDocument()
    })

    test('shows no notice while the package is editable', ({ render, app }) => {
      mockAgreement.mockReturnValue({
        data: agreement,
        isLoading: false,
        isError: false,
        error: null
      })
      render(<InitiativeAgreementDetail />, app)
      expect(
        screen.queryByTestId('package-lock-notice')
      ).not.toBeInTheDocument()
    })

    test.for([roles.ia_analyst, roles.ia_manager])(
      'gives a %s no Edit, upload or add-action control',
      (role, { render, app }) => {
        mockRoles = [{ name: role }]
        render(<InitiativeAgreementDetail />, app)
        expect(screen.queryByTestId('edit-agreement')).not.toBeInTheDocument()
        expect(
          screen.queryByTestId('upload-documents-button')
        ).not.toBeInTheDocument()
        expect(
          screen.queryByTestId('add-designated-action')
        ).not.toBeInTheDocument()
      }
    )

    test('makes the document tree and the notes read-only', ({
      render,
      app
    }) => {
      render(<InitiativeAgreementDetail />, app)
      expect(treeProps).toHaveBeenLastCalledWith(
        expect.objectContaining({ readOnly: true })
      )
      expect(screen.getByTestId('notes-accordion')).toHaveAttribute(
        'data-read-only',
        'true'
      )
    })

    test('keeps the comment thread and the actions grid', ({ render, app }) => {
      render(<InitiativeAgreementDetail />, app)
      expect(screen.getByTestId('comments-component')).toBeInTheDocument()
      expect(screen.getByTestId('designated-actions-grid')).toBeInTheDocument()
    })

    test('gives a BCeID proponent the read-only list and no notice', ({
      render,
      app
    }) => {
      mockRoles = [{ name: roles.ia_proponent }]
      render(<InitiativeAgreementDetail />, app)
      expect(screen.queryByTestId('edit-agreement')).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('upload-documents-button')
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('document-tree')).not.toBeInTheDocument()
      // The notice speaks to the staff who would otherwise edit.
      expect(
        screen.queryByTestId('package-lock-notice')
      ).not.toBeInTheDocument()
    })
  })
})

describe('InitiativeAgreementDetail in a change order (#5555)', () => {
  const inChangeOrder = {
    ...agreement,
    lifecycleStatus: { status: 'Change order draft' },
    changeOrderState: 'edited',
    changeOrder: {
      initiativeAgreementChangeOrderId: 3,
      changeOrderNumber: 2,
      status: 'Draft',
      startedByDisplayName: 'Ana Analyst',
      createDate: '2026-11-24T18:00:00Z'
    },
    changeOrderActions: ['accept', 'discard']
  }

  beforeEach(() => {
    mockRoles = [{ name: roles.director }]
    mockDocuments.mockReturnValue({ data: [], refetch: vi.fn() })
  })

  test('shows the draft banner and marks the edited details', ({
    render,
    app
  }) => {
    mockAgreement.mockReturnValue({
      data: inChangeOrder,
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, app)

    expect(screen.getByTestId('change-order-banner')).toBeInTheDocument()
    expect(screen.getByTestId('accept-change-order')).toBeInTheDocument()
    expect(screen.getByTestId('agreement-status-chip')).toHaveTextContent(
      'Change order draft'
    )
    expect(screen.getByTestId('change-order-state')).toHaveAttribute(
      'data-state',
      'edited'
    )
  })

  test('lets the Director edit the details only inside a change order', ({
    render,
    app
  }) => {
    mockAgreement.mockReturnValue({
      data: inChangeOrder,
      isLoading: false,
      isError: false,
      error: null
    })
    const { unmount } = render(<InitiativeAgreementDetail />, app)
    expect(screen.getByTestId('edit-agreement')).toBeInTheDocument()
    unmount()

    mockAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, app)
    expect(screen.queryByTestId('edit-agreement')).toBeNull()
  })

  test('shows an organization no change order controls', ({ render, app }) => {
    mockRoles = [{ name: roles.ia_proponent }]
    mockAgreement.mockReturnValue({
      // What the API sends an organization while IDIR drafts a change.
      data: agreement,
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, app)

    expect(screen.queryByTestId('change-order-panel')).toBeNull()
    expect(screen.queryByTestId('change-order-history')).toBeNull()
  })
})
