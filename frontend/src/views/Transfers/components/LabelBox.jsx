import PropTypes from 'prop-types'
import { Typography } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

export const LabelBox = ({
  label,
  description,
  children,
  labelVariant,
  descriptionVariant,
  ...boxProps
}) => {
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
            <Typography variant={descriptionVariant || 'body2'} mb={1}>
              {description}
            </Typography>
          )}
          {children}
        </BCBox>
      </BCBox>
    </>
  )
}

LabelBox.propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  labelVariant: PropTypes.string,
  descriptionVariant: PropTypes.string
}
