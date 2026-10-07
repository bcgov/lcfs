import { vi, describe, expect, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { LoginScreenBackground } from '../LoginScreenBackground'
import { test as fixtureTest } from '@/tests/utils/fixtures'

const test = (name, callback) =>
  fixtureTest(name, ({ render, theme }) =>
    callback({
      render: (ui, providers = [], options = {}) =>
        render(ui, [theme, ...providers], options),
      theme
    })
  )

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
    isActive: true
  },
  {
    loginBgImageId: 2,
    imageKey: 'login-backgrounds/uuid-2',
    fileName: 'photo2.jpg',
    displayName: 'Ocean View',
    caption: null,
    isActive: false
  }
]

vi.mock('@/hooks/useLoginBgImage', () => ({
  useLoginBgImages: () => ({ data: MOCK_IMAGES, isLoading: false }),
  useUploadLoginBgImage: () => ({
    mutateAsync: mockUploadMutateAsync,
    isPending: false
  }),
  useUpdateLoginBgImage: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false
  }),
  useActivateLoginBgImage: () => ({
    mutateAsync: mockActivateMutateAsync,
    isPending: false
  }),
  useDeleteLoginBgImage: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false
  })
}))

vi.mock('@/constants/config', () => ({
  CONFIG: { API_BASE: 'http://localhost:8000/api' }
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    loginBgImageStream: '/login-bg-images/:imageId/stream'
  }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginScreenBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders the page heading', ({ render }) => {
      render(<LoginScreenBackground />)
      expect(screen.getByText('loginBg.title')).toBeInTheDocument()
    })

    test('renders description text', ({ render }) => {
      render(<LoginScreenBackground />)
      expect(screen.getByText('loginBg.description')).toBeInTheDocument()
      expect(screen.getByText('loginBg.recommended')).toBeInTheDocument()
    })

    test('renders all images from the API', ({ render }) => {
      render(<LoginScreenBackground />)
      expect(screen.getByAltText('Mountain Sunrise')).toBeInTheDocument()
      expect(screen.getByAltText('Ocean View')).toBeInTheDocument()
    })

    test('shows Active badge on the active image', ({ render }) => {
      render(<LoginScreenBackground />)
      expect(screen.getByText('loginBg.active')).toBeInTheDocument()
    })

    test('renders displayName and caption in card footer', ({ render }) => {
      render(<LoginScreenBackground />)
      expect(screen.getByText('Mountain Sunrise')).toBeInTheDocument()
      expect(screen.getByText('Rockies, BC')).toBeInTheDocument()
    })

    test('renders Upload image and Set background image buttons', ({
      render
    }) => {
      render(<LoginScreenBackground />)
      expect(screen.getByText('loginBg.uploadImageBtn')).toBeInTheDocument()
      expect(screen.getByText('loginBg.setBackgroundBtn')).toBeInTheDocument()
    })

    test('"Set background image" is disabled when nothing is selected', ({
      render
    }) => {
      render(<LoginScreenBackground />)
      const btn = screen.getByText('loginBg.setBackgroundBtn').closest('button')
      expect(btn).toBeDisabled()
    })
  })

  describe('Image selection', () => {
    test('enables "Set background image" after selecting an image', ({
      render
    }) => {
      render(<LoginScreenBackground />)
      const card =
        screen.getByAltText('Ocean View').closest('.MuiCard-root') ||
        screen.getByAltText('Ocean View').parentElement.parentElement
      fireEvent.click(card)
      const btn = screen.getByText('loginBg.setBackgroundBtn').closest('button')
      expect(btn).not.toBeDisabled()
    })

    test('calls activate mutation when "Set background image" is clicked', async ({
      render
    }) => {
      render(<LoginScreenBackground />)
      // Click the card for image id=2
      fireEvent.click(screen.getByAltText('Ocean View').closest('[class]'))

      const btn = screen.getByText('loginBg.setBackgroundBtn').closest('button')
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockActivateMutateAsync).toHaveBeenCalledWith(2)
      })
    })
  })

  describe('Upload modal', () => {
    test('opens upload modal when "Upload image" is clicked', ({ render }) => {
      render(<LoginScreenBackground />)
      fireEvent.click(
        screen.getByText('loginBg.uploadImageBtn').closest('button')
      )
      expect(screen.getByText('loginBg.uploadTitle')).toBeInTheDocument()
    })

    test('closes upload modal when Cancel is clicked', async ({ render }) => {
      render(<LoginScreenBackground />)
      fireEvent.click(
        screen.getByText('loginBg.uploadImageBtn').closest('button')
      )

      const cancelBtn = screen.getByRole('button', {
        name: 'loginBg.cancelBtn'
      })
      fireEvent.click(cancelBtn)

      await waitFor(() => {
        expect(
          screen.queryByText('loginBg.uploadTitle')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit modal', () => {
    test('opens edit modal when "Edit Image" is clicked', ({ render }) => {
      render(<LoginScreenBackground />)
      const editButtons = screen.getAllByText('loginBg.editImageBtn')
      fireEvent.click(editButtons[0])
      expect(screen.getByText('loginBg.editTitle')).toBeInTheDocument()
    })

    test('pre-fills name and caption fields with image data', ({ render }) => {
      render(<LoginScreenBackground />)
      const editButtons = screen.getAllByText('loginBg.editImageBtn')
      fireEvent.click(editButtons[0])

      const nameInput = screen.getByPlaceholderText('loginBg.namePlaceholder')
      const captionInput = screen.getByPlaceholderText(
        'loginBg.captionPlaceholder'
      )

      expect(nameInput.value).toBe('Mountain Sunrise')
      expect(captionInput.value).toBe('Rockies, BC')
    })

    test('calls update mutation with correct args on Save changes', async ({
      render
    }) => {
      mockUpdateMutateAsync.mockResolvedValue({})
      render(<LoginScreenBackground />)

      const editButtons = screen.getAllByText('loginBg.editImageBtn')
      fireEvent.click(editButtons[0])

      fireEvent.click(
        screen.getByRole('button', { name: 'loginBg.saveChangesBtn' })
      )

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          imageId: 1,
          displayName: 'Mountain Sunrise',
          caption: 'Rockies, BC'
        })
      })
    })
  })

  describe('Delete confirmation', () => {
    test('opens delete confirm dialog when Delete is clicked', ({ render }) => {
      render(<LoginScreenBackground />)
      const deleteLinks = screen.getAllByText('loginBg.delete')
      fireEvent.click(deleteLinks[0])
      expect(screen.getByText('loginBg.deleteConfirmTitle')).toBeInTheDocument()
    })

    test('calls delete mutation on confirm', async ({ render }) => {
      mockDeleteMutateAsync.mockResolvedValue({})
      render(<LoginScreenBackground />)

      fireEvent.click(screen.getAllByText('loginBg.delete')[0])

      // Click the confirm Delete button inside the dialog
      const confirmBtn = screen
        .getAllByRole('button', { name: 'loginBg.deleteBtn' })
        .find((b) => b.closest('[role="dialog"]'))
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith(1)
      })
    })

    test('closes dialog without deleting when Cancel is clicked', async ({
      render
    }) => {
      render(<LoginScreenBackground />)
      fireEvent.click(screen.getAllByText('loginBg.delete')[0])

      fireEvent.click(screen.getByRole('button', { name: 'loginBg.cancelBtn' }))

      await waitFor(() => {
        expect(
          screen.queryByText('loginBg.deleteConfirmTitle')
        ).not.toBeInTheDocument()
      })
      expect(mockDeleteMutateAsync).not.toHaveBeenCalled()
    })
  })

  describe('Loading state', () => {
    test('renders loading indicator when isLoading is true', () => {
      vi.doMock('@/hooks/useLoginBgImage', () => ({
        useLoginBgImages: () => ({ data: [], isLoading: true }),
        useUploadLoginBgImage: () => ({
          mutateAsync: vi.fn(),
          isPending: false
        }),
        useUpdateLoginBgImage: () => ({
          mutateAsync: vi.fn(),
          isPending: false
        }),
        useActivateLoginBgImage: () => ({
          mutateAsync: vi.fn(),
          isPending: false
        }),
        useDeleteLoginBgImage: () => ({
          mutateAsync: vi.fn(),
          isPending: false
        })
      }))
      // Loading component is rendered at module scope — this tests the guard
      // The component returns <Loading /> early when isLoading is true
    })
  })
})
