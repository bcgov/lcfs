import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import SigningAuthorityDeclaration from '../SigningAuthorityDeclaration'

// Mock the useNavigate hook
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Checkbox: ({ onChange, checked }) => (
    <input type="checkbox" onChange={onChange} checked={checked} data-test="checkbox" />
  ),
  FormControlLabel: ({ control, label }) => (
    <label>
      {control}
      <span>{label}</span>
    </label>
  ),
  Paper: ({ children }) => <div>{children}</div>,
}))

// Mock custom components
vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick }) => (
    <button onClick={onClick} data-test="submit-button">{children}</button>
  ),
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

describe('SigningAuthorityDeclaration', () => {
  it('renders the component correctly', () => {
    render(<SigningAuthorityDeclaration />)
    expect(screen.getByText('Signing authority declaration')).toBeInTheDocument()
    expect(screen.getByText(/I certify that the information in this report is true/)).toBeInTheDocument()
    expect(screen.getByTestId('checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('checkbox is initially unchecked', () => {
    render(<SigningAuthorityDeclaration />)
    const checkbox = screen.getByTestId('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('checkbox can be checked and unchecked', () => {
    render(<SigningAuthorityDeclaration />)
    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('submit button is rendered with correct text', () => {
    render(<SigningAuthorityDeclaration />)
    const submitButton = screen.getByTestId('submit-button')
    expect(submitButton).toHaveTextContent('Submit Report')
  })

  it('calls console.log when submit button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    render(<SigningAuthorityDeclaration />)
    const submitButton = screen.getByTestId('submit-button')
    const checkbox = screen.getByTestId('checkbox')
    
    // Click submit without checking the box
    fireEvent.click(submitButton)
    expect(consoleSpy).toHaveBeenCalledWith('Please certify the information before submitting')

    // Check the box and submit
    fireEvent.click(checkbox)
    fireEvent.click(submitButton)
    expect(consoleSpy).toHaveBeenCalledWith('Report submitted')

    consoleSpy.mockRestore()
  })
})