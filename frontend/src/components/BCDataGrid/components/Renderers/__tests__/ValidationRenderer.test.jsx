import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { ValidationRenderer } from '../ValidationRenderer'

const theme = createTheme()

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('ValidationRenderer', () => {
  let mockApi
  let defaultProps

  beforeEach(() => {
    mockApi = {
      stopEditing: vi.fn()
    }
    defaultProps = {
      data: {
        isValid: false,
        validationMsg: 'Test validation message'
      },
      api: mockApi,
      enableSave: false
    }
  })

  describe('Invalid Data Rendering', () => {
    it('renders Warning icon when data is invalid', () => {
      renderWithTheme(<ValidationRenderer {...defaultProps} />)
      
      const warningElement = screen.getByRole('button', { name: 'shows sign for validation' })
      expect(warningElement).toBeInTheDocument()
      expect(warningElement).toHaveAttribute('aria-label', 'shows sign for validation')
    })

  })

  describe('Valid Data Rendering', () => {
    it('renders DoneAll icon when data is valid', () => {
      const props = {
        ...defaultProps,
        data: { isValid: true, validationMsg: 'Valid' }
      }
      renderWithTheme(<ValidationRenderer {...props} />)
      
      const validationElement = screen.getByRole('button', { name: 'shows sign for validation' })
      expect(validationElement).toBeInTheDocument()
      expect(validationElement).toHaveAttribute('aria-label', 'shows sign for validation')
    })

  })

  describe('Save Button Rendering', () => {
    it('renders Save button when enableSave is true', () => {
      const props = { ...defaultProps, enableSave: true }
      renderWithTheme(<ValidationRenderer {...props} />)
      
      const saveButton = screen.getByRole('button', { name: 'shows sign for saving' })
      expect(saveButton).toBeInTheDocument()
      expect(saveButton).toHaveAttribute('aria-label', 'shows sign for saving')
    })

    it('does not render Save button when enableSave is false', () => {
      renderWithTheme(<ValidationRenderer {...defaultProps} />)
      
      const saveButton = screen.queryByRole('button', { name: 'shows sign for saving' })
      expect(saveButton).not.toBeInTheDocument()
    })

  })

  describe('Save Button Functionality', () => {
    it('calls api.stopEditing when Save button is clicked', () => {
      const props = { ...defaultProps, enableSave: true }
      renderWithTheme(<ValidationRenderer {...props} />)
      
      const saveButton = screen.getByRole('button', { name: 'shows sign for saving' })
      fireEvent.click(saveButton)
      
      expect(mockApi.stopEditing).toHaveBeenCalledTimes(1)
    })
  })

  describe('Combined Scenarios', () => {
    it('renders both validation icon and save button when both conditions are met', () => {
      const props = {
        ...defaultProps,
        data: { isValid: true, validationMsg: 'Valid' },
        enableSave: true
      }
      renderWithTheme(<ValidationRenderer {...props} />)
      
      expect(screen.getByRole('button', { name: 'shows sign for validation' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'shows sign for saving' })).toBeInTheDocument()
    })

    it('renders invalid icon and save button when data invalid but save enabled', () => {
      const props = { ...defaultProps, enableSave: true }
      renderWithTheme(<ValidationRenderer {...props} />)
      
      expect(screen.getByRole('button', { name: 'shows sign for validation' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'shows sign for saving' })).toBeInTheDocument()
    })
  })
})