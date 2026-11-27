import type { ComponentProps, ReactNode } from 'react'
import type { TypographyProps } from '@mui/material/Typography'
import '@mui/material/Typography'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

interface LabelBoxProps extends Omit<ComponentProps<typeof BCBox>, 'ref'> {
  label?: string | null
  description?: string | null
  children: ReactNode
  labelVariant?: TypographyProps['variant']
  descriptionVariant?: TypographyProps['variant']
}

export const LabelBox = ({
  label,
  description,
  children,
  labelVariant,
  descriptionVariant,
  ...boxProps
}: LabelBoxProps) => {
  return (
    <>
      {label && (
        <BCTypography variant={labelVariant || 'h6'} mt={2} color={'primary'}>
          {label}
        </BCTypography>
      )}
      <BCBox
        variant="bordered"
        borderRadius="sm"
        mt={1}
        p={2}
        mb={1}
        {...boxProps}
      >
        <BCBox className="labelBoxContent">
          {description && (
            <BCTypography variant={descriptionVariant || 'body2'} mb={1}>
              {description}
            </BCTypography>
          )}
          {children}
        </BCBox>
      </BCBox>
    </>
  )
}
