import BCTypography from '@/components/BCTypography'
import PropType from 'prop-types'
import type { ReactNode } from 'react'

export interface CustomLabelProps {
  header: ReactNode
  text: ReactNode
}

export const CustomLabel = ({ header, text }: CustomLabelProps) => (
  <BCTypography variant="body4" component="span">
    <strong>{header}</strong> —&nbsp;{text}
  </BCTypography>
)

CustomLabel.propTypes = {
  header: PropType.string.isRequired,
  text: PropType.string.isRequired
}
