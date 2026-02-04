import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ExcelUpload } from '../ExcelUpload'
import theme from '@/themes'

const mockOnImportComplete = vi.fn()
let latestOnComplete = null

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    download: vi.fn()
  })
}))

vi.mock('@/components/ImportDialog', () => ({
  __esModule: true,
  default: (props) => {
    latestOnComplete = props.onComplete
    if (!props.open) {
      return null
    }
    return <div data-test="import-dialog" />
  }
}))

describe('ExcelUpload import dialog behaviour', () => {
  beforeEach(() => {
    latestOnComplete = null
    mockOnImportComplete.mockClear()
  })

  const openDialog = () => {
    render(
      <ThemeProvider theme={theme}>
        <ExcelUpload
          organizationId={123}
          onImportComplete={mockOnImportComplete}
        />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByText('chargingEquipment:importBtn'))
    expect(screen.getByTestId('import-dialog')).toBeInTheDocument()
  }

  it('auto-closes the dialog when there are no rejections', () => {
    openDialog()
    act(() => {
      latestOnComplete?.({ rejected: 0, errors: [] })
    })
    expect(mockOnImportComplete).toHaveBeenCalled()
    expect(screen.queryByTestId('import-dialog')).not.toBeInTheDocument()
  })

  it('keeps the dialog open when there are rejected rows', () => {
    openDialog()
    act(() => {
      latestOnComplete?.({ rejected: 2, errors: [] })
    })
    expect(mockOnImportComplete).toHaveBeenCalled()
    expect(screen.getByTestId('import-dialog')).toBeInTheDocument()
  })

  it('keeps the dialog open when backend errors are returned', () => {
    openDialog()
    act(() => {
      latestOnComplete?.({ rejected: 0, errors: ['error'] })
    })
    expect(mockOnImportComplete).toHaveBeenCalled()
    expect(screen.getByTestId('import-dialog')).toBeInTheDocument()
  })
})
