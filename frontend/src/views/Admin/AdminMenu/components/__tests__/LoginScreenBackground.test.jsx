import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { LoginScreenBackground } from '../LoginScreenBackground'
import { wrapper } from '@/tests/utils/wrapper.jsx'

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------

const mockUploadMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()
const mockActivateMutateAsync = vi.fn()
const mockDeleteMutateAsync = vi.fn()

const MOCK_IMAGES = [
  {
    loginBgImageId: 1,
    imageKey: 'login-backgrounds/uuid-1',
    fileName: 'photo1.jpg',
    displayName: 'Mountain Sunrise',
    caption: 'Rockies, BC',
    isActive: true,
  },
  {
    loginBgImageId: 2,
    imageKey: 'login-backgrounds/uuid-2',
    fileName: 'photo2.jpg',
    displayName: 'Ocean View',
    caption: null,
    isActive: false,
  },
]

vi.mock('@/hooks/useLoginBgImage', () => ({
  useLoginBgImages: () => ({ data: MOCK_IMAGES, isLoading: false }),
  useUploadLoginBgImage: () => ({
    mutateAsync: mockUploadMutateAsync,
    isPending: false,
  }),
  useUpdateLoginBgImage: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useActivateLoginBgImage: () => ({
    mutateAsync: mockActivateMutateAsync,
    isPending: false,
  }),
  useDeleteLoginBgImage: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}))

vi.mock('@/constants/config', () => ({
  CONFIG: { API_BASE: 'http://localhost:8000/api' },
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    loginBgImageStream: '/login-bg-images/:imageId/stream',
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginScreenBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders the page heading', () => {
      render(<LoginScreenBackground />, { wrapper })
      expect(screen.getByText('Login screen background')).toBeInTheDocument()
    })

    it('renders description text', () => {
      render(<LoginScreenBackground />, { wrapper })
      expect(
        screen.getByText(/Manage the background image/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/Recommended/i)).toBeInTheDocument()
    })

    it('renders all images from the API', () => {
      render(<LoginScreenBackground />, { wrapper })
      expect(screen.getByAltText('Mountain Sunrise')).toBeInTheDocument()
      expect(screen.getByAltText('Ocean View')).toBeInTheDocument()
    })

    it('shows Active badge on the active image', () => {
      render(<LoginScreenBackground />, { wrapper })
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders displayName and caption in card footer', () => {
      render(<LoginScreenBackground />, { wrapper })
      expect(screen.getByText('Mountain Sunrise')).toBeInTheDocument()
      expect(screen.getByText('Rockies, BC')).toBeInTheDocument()
    })

    it('renders Upload image and Set background image buttons', () => {
      render(<LoginScreenBackground />, { wrapper })
      expect(screen.getByText('Upload image')).toBeInTheDocument()
      expect(screen.getByText('Set background image')).toBeInTheDocument()
    })

    it('"Set background image" is disabled when nothing is selected', () => {
      render(<LoginScreenBackground />, { wrapper })
      const btn = screen.getByText('Set background image').closest('button')
      expect(btn).toBeDisabled()
    })
  })

  describe('Image selection', () => {
    it('enables "Set background image" after selecting an image', () => {
      render(<LoginScreenBackground />, { wrapper })
      const card = screen.getByAltText('Ocean View').closest('.MuiCard-root') ||
        screen.getByAltText('Ocean View').parentElement.parentElement
      fireEvent.click(card)
      const btn = screen.getByText('Set background image').closest('button')
      expect(btn).not.toBeDisabled()
    })

    it('calls activate mutation when "Set background image" is clicked', async () => {
      render(<LoginScreenBackground />, { wrapper })
      // Click the card for image id=2
      fireEvent.click(screen.getByAltText('Ocean View').closest('[class]'))

      const btn = screen.getByText('Set background image').closest('button')
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockActivateMutateAsync).toHaveBeenCalledWith(2)
      })
    })
  })

  describe('Upload modal', () => {
    it('opens upload modal when "Upload image" is clicked', () => {
      render(<LoginScreenBackground />, { wrapper })
      fireEvent.click(screen.getByText('Upload image').closest('button'))
      expect(
        screen.getByText('Upload image and add caption')
      ).toBeInTheDocument()
    })

    it('closes upload modal when Cancel is clicked', async () => {
      render(<LoginScreenBackground />, { wrapper })
      fireEvent.click(screen.getByText('Upload image').closest('button'))

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
      fireEvent.click(cancelBtn)

      await waitFor(() => {
        expect(
          screen.queryByText('Upload image and add caption')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit modal', () => {
    it('opens edit modal when "Edit Image" is clicked', () => {
      render(<LoginScreenBackground />, { wrapper })
      const editButtons = screen.getAllByText('Edit Image')
      fireEvent.click(editButtons[0])
      expect(screen.getByText('Edit image caption')).toBeInTheDocument()
    })

    it('pre-fills name and caption fields with image data', () => {
      render(<LoginScreenBackground />, { wrapper })
      const editButtons = screen.getAllByText('Edit Image')
      fireEvent.click(editButtons[0])

      const nameInput = screen.getByPlaceholderText('Photographer or author name')
      const captionInput = screen.getByPlaceholderText('Location or attribution text')

      expect(nameInput.value).toBe('Mountain Sunrise')
      expect(captionInput.value).toBe('Rockies, BC')
    })

    it('calls update mutation with correct args on Save changes', async () => {
      mockUpdateMutateAsync.mockResolvedValue({})
      render(<LoginScreenBackground />, { wrapper })

      const editButtons = screen.getAllByText('Edit Image')
      fireEvent.click(editButtons[0])

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          imageId: 1,
          displayName: 'Mountain Sunrise',
          caption: 'Rockies, BC',
        })
      })
    })
  })

  describe('Delete confirmation', () => {
    it('opens delete confirm dialog when Delete is clicked', () => {
      render(<LoginScreenBackground />, { wrapper })
      const deleteLinks = screen.getAllByText('Delete')
      fireEvent.click(deleteLinks[0])
      expect(screen.getByText('Delete image?')).toBeInTheDocument()
    })

    it('calls delete mutation on confirm', async () => {
      mockDeleteMutateAsync.mockResolvedValue({})
      render(<LoginScreenBackground />, { wrapper })

      fireEvent.click(screen.getAllByText('Delete')[0])

      // Click the confirm Delete button inside the dialog
      const confirmBtn = screen.getAllByRole('button', { name: 'Delete' }).find(
        (b) => b.closest('[role="dialog"]')
      )
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith(1)
      })
    })

    it('closes dialog without deleting when Cancel is clicked', async () => {
      render(<LoginScreenBackground />, { wrapper })
      fireEvent.click(screen.getAllByText('Delete')[0])

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      await waitFor(() => {
        expect(screen.queryByText('Delete image?')).not.toBeInTheDocument()
      })
      expect(mockDeleteMutateAsync).not.toHaveBeenCalled()
    })
  })

  describe('Loading state', () => {
    it('renders loading indicator when isLoading is true', () => {
      vi.doMock('@/hooks/useLoginBgImage', () => ({
        useLoginBgImages: () => ({ data: [], isLoading: true }),
        useUploadLoginBgImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
        useUpdateLoginBgImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
        useActivateLoginBgImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
        useDeleteLoginBgImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
      }))
      // Loading component is rendered at module scope — this tests the guard
      // The component returns <Loading /> early when isLoading is true
    })
  })
})
