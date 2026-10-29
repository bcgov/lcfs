import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRoutes } from '@/constants/routes'
import { useGetCIApplication } from '../useCIApplication'
import {
  useDeleteDocument,
  useDocuments,
  useUpdateDocument,
  useUploadDocument
} from '../useDocuments'

const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

describe('CI application document cache refresh', () => {
  let queryClient
  let documents
  const document = {
    documentId: 7,
    fileName: 'supporting.pdf',
    fileSize: 100
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    documents = []
    const applicationPath = apiRoutes.getCIApplication.replace(
      ':ciApplicationId',
      '99'
    )
    mockApiService.get.mockImplementation(async (path) => ({
      data:
        path === applicationPath
          ? { ciApplicationId: 99, documents: [...documents] }
          : [...documents]
    }))
  })

  afterEach(() => queryClient.clear())

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const useApplicationDocuments = (options) => ({
    application: useGetCIApplication('99'),
    documents: useDocuments('ci_application', 99),
    upload: useUploadDocument('ci_application', 99, options),
    delete: useDeleteDocument('ci_application', 99),
    update: useUpdateDocument('ci_application', 99)
  })

  it('refreshes both the upload list and application summary after upload', async () => {
    mockApiService.post.mockImplementation(async () => {
      documents = [document]
      return { data: document }
    })
    const { result } = renderHook(() => useApplicationDocuments(), { wrapper })
    await waitFor(() => {
      expect(result.current.application.data?.documents).toEqual([])
      expect(result.current.documents.data).toEqual([])
    })

    await act(async () => {
      await result.current.upload.mutateAsync(
        new File(['content'], 'supporting.pdf', { type: 'application/pdf' })
      )
    })

    await waitFor(() => {
      expect(result.current.documents.data).toEqual([document])
      expect(result.current.application.data.documents).toEqual([document])
    })
  })

  it('refreshes both lists after deleting a document', async () => {
    documents = [document]
    mockApiService.delete.mockImplementation(async () => {
      documents = []
      return { data: {} }
    })
    const { result } = renderHook(() => useApplicationDocuments(), { wrapper })
    await waitFor(() => {
      expect(result.current.application.data?.documents).toEqual([document])
      expect(result.current.documents.data).toEqual([document])
    })

    await act(async () => {
      await result.current.delete.mutateAsync(document.documentId)
    })

    await waitFor(() => {
      expect(result.current.documents.data).toEqual([])
      expect(result.current.application.data.documents).toEqual([])
    })
  })

  it('refreshes the displayed document name in both lists after renaming', async () => {
    documents = [document]
    const renamedDocument = { ...document, displayName: 'Renamed report.pdf' }
    mockApiService.put.mockImplementation(async () => {
      documents = [renamedDocument]
      return { data: renamedDocument }
    })
    const { result } = renderHook(() => useApplicationDocuments(), { wrapper })
    await waitFor(() => {
      expect(result.current.application.data?.documents).toEqual([document])
      expect(result.current.documents.data).toEqual([document])
    })

    await act(async () => {
      await result.current.update.mutateAsync({
        documentID: document.documentId,
        data: { displayName: renamedDocument.displayName }
      })
    })

    await waitFor(() => {
      expect(result.current.documents.data).toEqual([renamedDocument])
      expect(result.current.application.data.documents).toEqual([renamedDocument])
    })
  })

  it('preserves the option to skip refreshing the parent application', async () => {
    mockApiService.post.mockImplementation(async () => {
      documents = [document]
      return { data: document }
    })
    const { result } = renderHook(
      () => useApplicationDocuments({ invalidateRelatedQueries: false }),
      { wrapper }
    )
    await waitFor(() => {
      expect(result.current.application.data?.documents).toEqual([])
      expect(result.current.documents.data).toEqual([])
    })

    await act(async () => {
      await result.current.upload.mutateAsync(
        new File(['content'], 'supporting.pdf', { type: 'application/pdf' })
      )
    })

    await waitFor(() => {
      expect(result.current.documents.data).toEqual([document])
    })
    expect(result.current.application.data.documents).toEqual([])
  })
})
