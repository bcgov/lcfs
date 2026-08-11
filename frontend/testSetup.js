import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'
import { config } from './public/config/config'
import React from 'react'

configure({ testIdAttribute: 'data-test' })

beforeAll(() => {
  vi.stubGlobal('lcfs_config', config)
  vi.stubGlobal('scrollTo', vi.fn())
})

vi.mock('@/i18n', async () => ({
  default: (await import('./src/tests/i18nSetup.js')).default
}))

// Global component mocks to fix common warnings
vi.mock('@/components/BCBox', () => ({
  default: React.forwardRef(
    ({ children, jsx, justifyContent, flexWrap, ...props }, ref) => {
      // Filter out non-DOM props that cause warnings
      const {
        variant,
        bgColor,
        color,
        opacity,
        borderRadius,
        shadow,
        coloredShadow,
        component,
        ...domProps
      } = props
      return React.createElement(
        'div',
        { ref, ...domProps, style: { justifyContent, flexWrap } },
        children
      )
    }
  )
}))

vi.mock('@/components/BCAlert', () => ({
  default: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      triggerAlert: vi.fn(),
      show: vi.fn(),
      hide: vi.fn()
    }))
    const { children, severity, dismissible, noFade, delay, ...domProps } =
      props
    return React.createElement(
      'div',
      { 'data-test': 'bc-alert', ...domProps, 'data-severity': severity },
      children
    )
  }),
  BCAlert2: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      triggerAlert: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      clearAlert: vi.fn()
    }))
    const { children, severity, dismissible, noFade, delay, ...domProps } =
      props
    const testId = domProps['data-test'] || 'bc-alert-2'
    return React.createElement(
      'div',
      { 'data-test': testId, ...domProps, 'data-severity': severity },
      children
    )
  }),
  FloatingAlert: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      triggerAlert: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      clearAlert: vi.fn()
    }))
    const { children, severity, dismissible, noFade, delay, ...domProps } =
      props
    return React.createElement(
      'div',
      { 'data-test': 'floating-alert', ...domProps, 'data-severity': severity },
      children
    )
  })
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      api: vi.fn(),
      columnApi: vi.fn()
    }))
    const {
      children,
      jsx,
      justifyContent,
      gridRef,
      gridKey,
      columnDefs,
      rowData,
      defaultColDef,
      onGridReady,
      onCellValueChanged,
      ...domProps
    } = props
    return React.createElement(
      'div',
      {
        ref,
        ...domProps,
        'data-test': 'bc-grid-container',
        style: { justifyContent }
      },
      children
    )
  })
}))

// Mock form components
vi.mock('@/components/BCForm/BCFormText', () => ({
  BCFormText: ({
    name,
    control,
    label,
    optional,
    checkbox,
    checkboxLabel,
    onCheckboxChange,
    isChecked,
    disabled,
    ...props
  }) => {
    const { variant, fullWidth, ...domProps } = props
    // Create a properly labeled input that Testing Library can find by accessible name
    // Also handle form values correctly for React Hook Form integration
    return React.createElement('input', {
      id: name,
      name: name,
      'data-test': name,
      'data-testid': name,
      'data-variant': variant || 'outlined',
      'data-fullwidth': fullWidth || true,
      required: !optional,
      disabled: disabled,
      'aria-label': label, // This provides the accessible name
      placeholder: label, // Also add as placeholder for additional context
      ...domProps
    })
  }
}))

vi.mock('@/components/BCForm/BCFormRadio', () => ({
  BCFormRadio: ({ name, control, options = [], ...props }) => {
    return React.createElement(
      'div',
      { 'data-test': `${name}-radio-group` },
      options.map((option, index) =>
        React.createElement('input', {
          key: `${name}-${index}`,
          type: 'radio',
          name: name,
          value: option.value || option,
          'data-testid': option.dataTestId || `${name}${index + 1}`,
          'data-test': option.dataTestId || `${name}${index + 1}`
        })
      )
    )
  }
}))

vi.mock('@/components/BCForm/BCFormCheckbox', () => ({
  BCFormCheckbox: ({ name, form, options = [], ...props }) => {
    return React.createElement(
      'div',
      { 'data-test': `${name}-checkbox-group` },
      options.map((option, index) =>
        React.createElement('input', {
          key: `${name}-${index}`,
          type: 'checkbox',
          'data-test': option.dataTestId || `${name}${index + 1}`,
          'data-testid': option.dataTestId || `${name}${index + 1}`
        })
      )
    )
  }
}))

vi.mock('@/components/BCForm/BCFormAddressAutocomplete', () => ({
  BCFormAddressAutocomplete: ({
    name,
    control,
    label,
    checkbox,
    checkboxLabel,
    onCheckboxChange,
    isChecked,
    disabled,
    onSelectAddress,
    ...props
  }) => {
    return React.createElement('input', {
      'data-test': name,
      'data-name': name,
      'aria-label': label,
      placeholder: label,
      disabled: disabled,
      defaultValue: '',
      ...props
    })
  }
}))

// Mock BCModal
vi.mock('@/components/BCModal', () => ({
  default: ({ open, onClose, data }) => {
    if (!open || !data) return null
    return React.createElement(
      'div',
      { 'data-test': 'modal', role: 'dialog' },
      [
        React.createElement('div', { key: 'title' }, data.title),
        React.createElement('div', { key: 'content' }, data.content),
        React.createElement(
          'button',
          {
            key: 'primary',
            onClick: data.primaryButtonAction,
            role: 'button'
          },
          data.primaryButtonText || 'Confirm'
        ),
        React.createElement(
          'button',
          {
            key: 'secondary',
            onClick: onClose,
            role: 'button',
            'aria-label': data.secondaryButtonText || 'Cancel'
          },
          data.secondaryButtonText || 'Cancel'
        )
      ]
    )
  }
}))

vi.mock('@/components/BCForm/AddressAutocomplete', () => ({
  AddressAutocomplete: ({ name, ...props }) => {
    return React.createElement('input', {
      'data-test': 'address-autocomplete',
      'data-name': name,
      defaultValue: '',
      ...props
    })
  }
}))
