import { forwardRef, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'

import { RefObject } from 'react'

interface ClearFiltersButtonProps {
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
  color?: 'primary' | 'secondary'
  sx?: Record<string, any>
  buttonRef?: RefObject<HTMLButtonElement> | null
  disabled?: boolean
  [key: string]: any // For spreading additional props
}

export const ClearFiltersButton = forwardRef<HTMLButtonElement, ClearFiltersButtonProps>(({
  onClick,
  size = 'small',
  color = 'primary',
  sx = {},
  ...props
}: ClearFiltersButtonProps, ref) => {
  const { t } = useTranslation(['common'])

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  return (
    <BCButton
      ref={ref}
      variant="outlined"
      size={size}
      color={color}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      endIcon={
        <svg 
          version="1.2" 
          preserveAspectRatio="none" 
          viewBox="0 0 24 24" 
          className="small-icon"
          style={{ width: '16px', height: '16px', fill: 'currentColor' }}
        >
          <path d="m10.2 7.375-1.5-1.5H20q.325 0 .538.213.212.212.212.537 0 .3-.212.525-.213.225-.538.225Zm5.175 5.175-1.5-1.5H17q.325 0 .538.225.212.225.212.525 0 .325-.212.537-.213.213-.538.213ZM13 17.75h-2q-.325 0-.537-.212-.213-.213-.213-.538 0-.325.213-.538.212-.212.537-.212h2q.325 0 .538.212.212.213.212.538 0 .325-.212.538-.213.212-.538.212Zm6.275 3.65-8.85-8.85H7q-.325 0-.537-.213-.213-.212-.213-.537 0-.3.213-.525.212-.225.537-.225h1.925l-6.35-6.325Q2.35 4.5 2.35 4.188q0-.313.225-.538.25-.225.55-.225.3 0 .525.225l16.7 16.7q.225.225.225.525 0 .3-.225.525-.225.225-.538.225-.312 0-.537-.225ZM5.225 5.875v1.5H4q-.325 0-.537-.225-.213-.225-.213-.525 0-.325.213-.537.212-.213.537-.213Z" />
        </svg>
      }
      sx={{...sx}}
      {...props}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
})