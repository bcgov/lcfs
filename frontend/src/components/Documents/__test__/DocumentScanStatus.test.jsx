import { test } from '@/tests/utils/fixtures'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import DocumentScanStatus from '../DocumentScanStatus'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useReviewDocumentScan } from '@/hooks/useDocuments'

vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/hooks/useDocuments', () => ({ useReviewDocumentScan: vi.fn() }))

const FINDINGS = [
  'Contains macros (2 code modules)',
  'Runs automatically when the file is opened'
]

const pendingDocument = {
  documentId: 7,
  fileName: 'ghg-model.xlsm',
  scanStatus: 'pending_approval',
  scanFindings: FINDINGS
}

const asUser = ({ government = false, administrator = false } = {}) =>
  useCurrentUser.mockReturnValue({
    data: { isGovernmentUser: government },
    hasRoles: vi.fn((role) => administrator && role === 'Administrator')
  })

describe('DocumentScanStatus', () => {
  let reviewScan

  beforeEach(() => {
    vi.clearAllMocks()
    reviewScan = vi.fn().mockResolvedValue({})
    useReviewDocumentScan.mockReturnValue({ mutateAsync: reviewScan })
  })

  const renderStatus = (render, providers, document = pendingDocument) =>
    render(
      <DocumentScanStatus
        document={document}
        parentType="ci_application"
        parentID={5}
      />,
      providers
    )

  for (const scanStatus of ['clean', 'legacy', undefined]) {
    test(`shows nothing for a ${scanStatus} file`, ({
      render,
      theme,
      i18n
    }) => {
      asUser({ government: true, administrator: true })
      renderStatus(render, [theme, i18n], { documentId: 1, scanStatus })
      expect(screen.queryByTestId('document-scan-status')).toBeNull()
    })
  }

  const confirmIn = async (name) =>
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name })
    )

  test('a supplier sees only that the file is under review', async ({
    render,
    theme,
    i18n
  }) => {
    asUser()
    renderStatus(render, [theme, i18n])

    expect(await screen.findByText('Under review')).toBeInTheDocument()
    expect(screen.queryByTestId('document-scan-approve')).toBeNull()
    expect(screen.queryByText(FINDINGS[1])).toBeNull()
  })

  test('staff see the flag but only administrators can decide', async ({
    render,
    theme,
    i18n
  }) => {
    asUser({ government: true })
    renderStatus(render, [theme, i18n])

    expect(
      await screen.findByText('Contains macros – awaiting approval')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('document-scan-approve')).toBeNull()
    expect(screen.queryByTestId('document-scan-reject')).toBeNull()
  })

  test('an administrator approves after seeing the findings', async ({
    render,
    theme,
    i18n
  }) => {
    asUser({ government: true, administrator: true })
    renderStatus(render, [theme, i18n])

    fireEvent.click(await screen.findByTestId('document-scan-approve'))

    expect(await screen.findByText('Approve this file?')).toBeInTheDocument()
    expect(screen.getByText(FINDINGS[1])).toBeInTheDocument()

    await confirmIn('Approve')

    await waitFor(() =>
      expect(reviewScan).toHaveBeenCalledWith({
        documentID: 7,
        decision: 'approve'
      })
    )
  })

  test('an administrator can reject the file', async ({
    render,
    theme,
    i18n
  }) => {
    asUser({ government: true, administrator: true })
    renderStatus(render, [theme, i18n])

    fireEvent.click(await screen.findByTestId('document-scan-reject'))
    await confirmIn('Reject')

    await waitFor(() =>
      expect(reviewScan).toHaveBeenCalledWith({
        documentID: 7,
        decision: 'reject'
      })
    )
  })

  test('a failed decision says so', async ({ render, theme, i18n }) => {
    asUser({ government: true, administrator: true })
    reviewScan.mockRejectedValue(new Error('boom'))
    renderStatus(render, [theme, i18n])

    fireEvent.click(await screen.findByTestId('document-scan-approve'))
    await confirmIn('Approve')

    expect(
      await screen.findByText(
        "The decision couldn't be saved, please try again."
      )
    ).toBeInTheDocument()
  })

  test('approved files are marked for staff only', async ({
    render,
    theme,
    i18n
  }) => {
    const approved = { ...pendingDocument, scanStatus: 'approved' }

    asUser({ government: true })
    const { unmount } = renderStatus(render, [theme, i18n], approved)
    expect(await screen.findByText('Macros approved')).toBeInTheDocument()
    unmount()

    asUser()
    renderStatus(render, [theme, i18n], approved)
    expect(screen.queryByTestId('document-scan-status')).toBeNull()
  })

  test('rejected files are marked for everyone', async ({
    render,
    theme,
    i18n
  }) => {
    asUser()
    renderStatus(render, [theme, i18n], {
      ...pendingDocument,
      scanStatus: 'rejected'
    })
    expect(await screen.findByText('Rejected')).toBeInTheDocument()
  })
})
