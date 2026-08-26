/**
 * Accessibility checks for the Initiative Agreements components.
 *
 * Every ticket in this module carries a WCAG 2.2 line on its checklist.
 * These run axe against each component so regressions are caught in CI
 * rather than by a person clicking around.
 *
 * Two limits worth stating: colour contrast cannot be judged in jsdom,
 * which does not lay out or paint, so that rule is off here and belongs
 * in the Cypress pass; and axe finds machine-checkable failures, which is
 * a floor, not a substitute for driving the pages with a keyboard.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import axe from 'axe-core'

import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { EvidenceOfCompletion } from '../components/EvidenceOfCompletion'
import { DesignatedActionWorkflow } from '../components/DesignatedActionWorkflow'
import { DesignatedActionHistoryPanel } from '../components/DesignatedActionHistoryPanel'
import { DocumentTree } from '../components/DocumentTree'
import { DAAssignedAnalystCell } from '../components/DAAssignedAnalystCell'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: [{ name: roles.ia_analyst }, { name: roles.ia_manager }] },
    hasRoles: () => true,
    hasAnyRole: () => true
  })
}))

vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => vi.fn(),
  useUpdateDocument: () => ({ mutateAsync: vi.fn() }),
  useDocuments: () => ({ data: [], refetch: vi.fn() })
}))

vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useEvidenceRequirements: () => ({
    data: [
      {
        evidenceRequirementId: 1,
        requirementNumber: 1,
        description: 'List of major permits and approvals',
        isActive: true,
        analystReview: 'Permits verified.',
        reviewOutcome: 'Satisfactory',
        reviewNotes: 'Copies filed.',
        reviewedBy: null,
        reviewedDate: null
      },
      {
        evidenceRequirementId: 2,
        requirementNumber: 2,
        description: 'Risk register',
        isActive: true,
        analystReview: '',
        reviewOutcome: 'Information requested',
        reviewNotes: null,
        reviewedBy: null,
        reviewedDate: null
      }
    ],
    isLoading: false
  }),
  useCreateEvidenceRequirement: () => ({ mutate: vi.fn() }),
  useUpdateEvidenceRequirement: () => ({ mutate: vi.fn() }),
  useDeleteEvidenceRequirement: () => ({ mutate: vi.fn() }),
  useDesignatedActionWorkflow: () => ({ mutate: vi.fn(), isPending: false }),
  useSetRecommendedCredits: () => ({ mutate: vi.fn() }),
  useDesignatedActionHistory: () => ({
    data: [
      {
        designatedActionHistoryId: 1,
        event: 'INFORMATION_REQUESTED',
        displayName: 'Alex Zorkin',
        createDate: '2026-08-26T10:14:00Z',
        status: null,
        snapshot: {
          comment: 'Send the signed permit.',
          evidence_requirements: [
            {
              evidence_requirement_id: 1,
              description: 'List of major permits',
              review_outcome: 'Satisfactory',
              analyst_review: 'Verified.'
            }
          ]
        }
      }
    ],
    isLoading: false
  }),
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
    mutate: vi.fn(),
    isPending: false
  })
}))

const mockSoftDelete = vi.fn()
vi.mock('@/hooks/useDocumentFolders', () => ({
  useDocumentTree: () => ({
    data: {
      folders: [
        {
          folderId: 12,
          name: 'Permits & Approvals',
          parentFolderId: null,
          sortOrder: 0,
          isSystem: false,
          documentCount: 1,
          documents: [
            {
              documentId: 88,
              fileName: 'permit.pdf',
              fileSize: 46080,
              createDate: '2026-05-12T00:00:00Z',
              createUser: 'LCFS1_bat'
            }
          ],
          children: []
        }
      ],
      rootDocuments: []
    },
    isLoading: false
  }),
  useCreateFolder: () => ({ mutate: vi.fn() }),
  useUpdateFolder: () => ({ mutate: vi.fn() }),
  useDeleteFolder: () => ({ mutate: vi.fn() }),
  useMoveDocuments: () => ({ mutate: vi.fn() }),
  useFolderUpload: () => ({ mutate: vi.fn() }),
  useSoftDeleteDocument: () => ({ mutate: mockSoftDelete }),
  useDeletedDocuments: () => ({ data: { documents: [], total: 0 } }),
  useRestoreDocument: () => ({ mutate: vi.fn() })
}))

const check = async (ui) => {
  const { container } = render(ui, { wrapper })
  const results = await axe.run(container, {
    rules: {
      // jsdom does not paint, so contrast cannot be judged here.
      'color-contrast': { enabled: false },
      // Components are rendered in isolation, without the page landmarks
      // and single h1 they sit inside.
      region: { enabled: false },
      'page-has-heading-one': { enabled: false }
    }
  })
  return results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${violation.id} [${node.html?.slice(0, 70)}]`
    )
  )
}

describe('Initiative Agreements accessibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('evidence of completion has no violations', async () => {
    expect(
      await check(<EvidenceOfCompletion designatedActionId="9" />)
    ).toEqual([])
  })

  it('the workflow actions have no violations', async () => {
    expect(
      await check(
        <DesignatedActionWorkflow
          designatedActionId="9"
          availableActions={[
            'accept_evidence',
            'request_information',
            'recommend_to_manager'
          ]}
          allEvidenceSatisfactory
          canEditCredits
          recommendedCredits={null}
          creditAllocation={1850}
        />
      )
    ).toEqual([])
  })

  it('the activity panel has no violations', async () => {
    expect(
      await check(<DesignatedActionHistoryPanel designatedActionId="9" />)
    ).toEqual([])
  })

  it('the document tree has no violations', async () => {
    expect(
      await check(<DocumentTree parentType="designatedAction" parentID="9" />)
    ).toEqual([])
  })

  it('the analyst assignment cell has no violations', async () => {
    expect(
      await check(
        <DAAssignedAnalystCell
          data={{ designatedActionId: 9, assignedAnalyst: null }}
        />
      )
    ).toEqual([])
  })
})
