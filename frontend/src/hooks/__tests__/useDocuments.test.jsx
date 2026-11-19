import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'

import { useQuery, useMutation } from '@tanstack/react-query'

import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useDownloadDocument,
  useFetchDocument,
  useGetDocumentInfo,
  useReviewDocumentScan,
  useUpdateDocument
} from '../useDocuments'

// Mock the API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    getDocuments: '/documents/:parentType/:parentID',
    documentFolderDeleteDocument:
      '/document-folders/:parentType/:parentID/documents/:documentId',
    getDocument: '/documents/:parentType/:parentID/:documentID',
    reviewDocumentScan:
      '/documents/:parentType/:parentID/:documentID/scan-review'
  }
}))

// Mock TanStack Query
const mockQueryClient = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn()
}))
const mockInvalidateQueries = mockQueryClient.invalidateQueries

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => mockQueryClient
}))

// Get the mocked functions
const mockUseQuery = useQuery
const mockUseMutation = useMutation

// Mock DOM methods for download functionality
const mockCreateObjectURL = vi.fn(() => 'mock-url')
const mockRevokeObjectURL = vi.fn()
const mockClick = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()

Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL
  },
  writable: true
})

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: mockClick,
    style: {}
  })),
  writable: true
})

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
  writable: true
})

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
  writable: true
})

describe('useDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useDocuments', () => {
    it('should call useQuery with correct parameters', () => {
      const mockQueryFn = vi.fn()
      mockUseQuery.mockImplementation(({ queryFn, ...options }) => {
        mockQueryFn.mockImplementation(queryFn)
        return {
          data: null,
          isLoading: false,
          isError: false,
          queryFn: mockQueryFn,
          ...options
        }
      })

      useDocuments('compliance_report', 123)

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ['documents', 'compliance_report', 123],
        queryFn: expect.any(Function),
        enabled: true,
        staleTime: 600000,
        gcTime: 900000,
        retry: 3,
        retryDelay: expect.any(Function)
      })
    })

    it('should be disabled when parentID is missing', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false
      })

      useDocuments('compliance_report', null)

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false
        })
      )
    })

    it('should be disabled when parentType is missing', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false
      })

      useDocuments(null, 123)

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false
        })
      )
    })

    it('should handle enabled option', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false
      })

      useDocuments('compliance_report', 123, { enabled: false })

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false
        })
      )
    })

    it('should make API call with correct path', async () => {
      let capturedQueryFn
      mockUseQuery.mockImplementation(({ queryFn }) => {
        capturedQueryFn = queryFn
        return { data: null, isLoading: false, isError: false }
      })
      mockApiService.get.mockResolvedValue({
        data: [{ id: 1, filename: 'test.pdf' }]
      })

      useDocuments('compliance_report', 123)

      // Call the captured queryFn to test the API call
      const result = await capturedQueryFn()

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/documents/compliance_report/123'
      )
      expect(result).toEqual([{ id: 1, filename: 'test.pdf' }])
    })
  })

  describe('useUploadDocument', () => {
    it('should call useMutation with correct parameters', () => {
      const mockMutationFn = vi.fn()
      mockUseMutation.mockImplementation(({ mutationFn, ...options }) => {
        mockMutationFn.mockImplementation(mutationFn)
        return {
          mutate: vi.fn(),
          mutationFn: mockMutationFn,
          ...options
        }
      })

      useUploadDocument('compliance_report', 123)

      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })

    it('should make API call with FormData', async () => {
      let capturedMutationFn
      mockUseMutation.mockImplementation(({ mutationFn }) => {
        capturedMutationFn = mutationFn
        return { mutate: vi.fn() }
      })
      mockApiService.post.mockResolvedValue({ data: { id: 1 } })

      useUploadDocument('compliance_report', 123)

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf'
      })
      const result = await capturedMutationFn(file)

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/documents/compliance_report/123',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      )
      expect(result.data.id).toBe(1)
    })

    it('passes the replacement document ID for a facility upload', async () => {
      let capturedMutationFn
      mockUseMutation.mockImplementation(({ mutationFn }) => {
        capturedMutationFn = mutationFn
        return { mutate: vi.fn() }
      })
      mockApiService.post.mockResolvedValue({ data: { id: 2 } })
      useUploadDocument('fuel_production_facility', 123)

      const file = new File(['content'], 'replacement.pdf', {
        type: 'application/pdf'
      })
      await capturedMutationFn({ file, replaceDocumentId: 7 })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/documents/fuel_production_facility/123',
        expect.any(FormData),
        expect.objectContaining({
          params: { replace_document_id: 7 }
        })
      )
    })
  })

  describe('useDeleteDocument', () => {
    it('should call useMutation with correct parameters', () => {
      const mockMutationFn = vi.fn()
      mockUseMutation.mockImplementation(({ mutationFn, ...options }) => {
        mockMutationFn.mockImplementation(mutationFn)
        return {
          mutate: vi.fn(),
          mutationFn: mockMutationFn,
          ...options
        }
      })

      useDeleteDocument('compliance_report', 123)

      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })

    it('should make API call with correct path', async () => {
      let capturedMutationFn
      mockUseMutation.mockImplementation(({ mutationFn }) => {
        capturedMutationFn = mutationFn
        return { mutate: vi.fn() }
      })
      mockApiService.delete.mockResolvedValue({ data: {} })

      useDeleteDocument('compliance_report', 123)

      const result = await capturedMutationFn(456)

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/documents/compliance_report/123/456'
      )
      expect(result.data).toEqual({})
    })

    it('soft-deletes designated-action files and refreshes the list, tree and bin', async () => {
      let mutation
      mockUseMutation.mockImplementation((options) => {
        mutation = options
        return { mutate: vi.fn() }
      })
      mockApiService.delete.mockResolvedValue({ data: {} })

      useDeleteDocument('designatedAction', 123)
      const response = await mutation.mutationFn(456)
      mutation.onSuccess(response, 456)

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/document-folders/designatedAction/123/documents/456'
      )
      for (const queryKey of [
        ['documents', 'designatedAction', 123],
        ['document-tree', 'designatedAction', '123'],
        ['document-tree-deleted', 'designatedAction', '123'],
        ['initiative-agreements', 'document-restore-targets']
      ]) {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey })
      }
    })
  })

  describe('useReviewDocumentScan', () => {
    it('sends the decision and refreshes the CI application', async () => {
      let options
      mockUseMutation.mockImplementation((opts) => {
        options = opts
        return { mutateAsync: vi.fn() }
      })
      mockApiService.put.mockResolvedValue({ data: {} })

      useReviewDocumentScan('ci_application', 5)
      await options.mutationFn({ documentID: 9, decision: 'approve' })
      options.onSuccess({}, {}, undefined)

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/documents/ci_application/5/9/scan-review',
        { decision: 'approve' }
      )
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['documents', 'ci_application', 5]
      })
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-application', '5']
      })
    })
    it('refreshes the CI application views after a facility file review', async () => {
      let options
      mockUseMutation.mockImplementation((opts) => {
        options = opts
        return { mutateAsync: vi.fn() }
      })
      mockApiService.put.mockResolvedValue({ data: {} })

      useReviewDocumentScan('fuel_production_facility', 12)
      await options.mutationFn({ documentID: 9, decision: 'reject' })
      options.onSuccess({}, {}, undefined)

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/documents/fuel_production_facility/12/9/scan-review',
        { decision: 'reject' }
      )
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['documents', 'fuel_production_facility', 12]
      })
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-application']
      })
    })
  })

  describe('useDownloadDocument', () => {
    it('should download document successfully', async () => {
      const mockBlob = new Blob(['file content'], { type: 'application/pdf' })
      mockApiService.get.mockResolvedValue({
        data: mockBlob,
        headers: { 'content-disposition': 'attachment; filename="test.pdf"' }
      })

      const downloadFn = useDownloadDocument('compliance_report', 123)
      await downloadFn(456)

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/documents/compliance_report/123/456',
        { responseType: 'blob' }
      )
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(mockClick).toHaveBeenCalled()
    })

    it('should handle custom filename', async () => {
      const mockBlob = new Blob(['file content'], { type: 'application/pdf' })
      mockApiService.get.mockResolvedValue({
        data: mockBlob,
        headers: {}
      })

      const downloadFn = useDownloadDocument('compliance_report', 123)
      await downloadFn(456, 'custom-name.pdf')

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/documents/compliance_report/123/456',
        { responseType: 'blob' }
      )
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
    })

    it('should throw error when required parameters are missing', async () => {
      const downloadFn = useDownloadDocument('compliance_report', 123)

      await expect(downloadFn(null)).rejects.toThrow(
        'Document ID is required for download'
      )
    })
  })

  describe('useFetchDocument', () => {
    it('should fetch document blob successfully', async () => {
      const mockBlob = new Blob(['file content'], { type: 'application/pdf' })
      const mockResponse = {
        data: mockBlob,
        headers: { 'content-type': 'application/pdf' }
      }
      mockApiService.get.mockResolvedValue(mockResponse)

      const fetchFn = useFetchDocument('compliance_report', 123)
      const result = await fetchFn(456)

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/documents/compliance_report/123/456',
        { responseType: 'blob' }
      )
      expect(result).toBe(mockResponse)
    })

    it('should throw error when preview documentID is missing', async () => {
      const fetchFn = useFetchDocument('compliance_report', 123)

      await expect(fetchFn(null)).rejects.toThrow(
        'Document ID is required for preview'
      )
    })
  })

  describe('useGetDocumentInfo', () => {
    it('should call useQuery with correct parameters', () => {
      const mockQueryFn = vi.fn()
      mockUseQuery.mockImplementation(({ queryFn, ...options }) => {
        mockQueryFn.mockImplementation(queryFn)
        return {
          data: null,
          isLoading: false,
          isError: false,
          queryFn: mockQueryFn,
          ...options
        }
      })

      useGetDocumentInfo('compliance_report', 123, 456)

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ['document-info', 'compliance_report', 123, 456],
        queryFn: expect.any(Function),
        enabled: true,
        staleTime: 600000,
        gcTime: 900000,
        retry: 3,
        retryDelay: expect.any(Function)
      })
    })

    it('should be disabled when documentID is missing', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false
      })

      useGetDocumentInfo('compliance_report', 123, null)

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false
        })
      )
    })
  })

  describe('useUpdateDocument', () => {
    it('should call useMutation with correct parameters', () => {
      const mockMutationFn = vi.fn()
      mockUseMutation.mockImplementation(({ mutationFn, ...options }) => {
        mockMutationFn.mockImplementation(mutationFn)
        return {
          mutate: vi.fn(),
          mutationFn: mockMutationFn,
          ...options
        }
      })

      useUpdateDocument('compliance_report', 123)

      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })
  })
})
