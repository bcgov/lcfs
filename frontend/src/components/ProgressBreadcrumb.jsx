import React from 'react'
import PropTypes from 'prop-types'
import { Breadcrumbs, Typography, Box, useMediaQuery } from '@mui/material'

/**
 * ProgressBreadcrumb Component
 *
 * Displays a breadcrumb trail for tracking progress through a series of steps.
 *
 * @param {Array} steps - An array of step names in the desired order.
 * @param {string} currentStep - The name of the current step.
 *
 * Usage:
 *
 * <ProgressBreadcrumb
 *   steps={['Draft', 'Sent', 'Submitted', 'Recorded']}
 *   currentStep='Sent'
 * />
 */
const ProgressBreadcrumb = ({ steps, currentStep }) => {
  const isSmallScreen = useMediaQuery('(max-width:900px)')
  const currentStepIndex = steps.indexOf(currentStep)

  const renderStep = (step, index) => {
    const isPast = index < currentStepIndex
    const isCurrent = index === currentStepIndex

    const stepStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      width: isSmallScreen ? '68px' : '188px',
      color: '#606060',
      '&:before':
        index < steps.length - 1
          ? {
              content: '""',
              position: 'absolute',
              ml: isSmallScreen ? -2 : -9.5,
              top: '10px',
              left: '100%',
              width: isSmallScreen ? '48px' : '168px',
              height: '1px',
              backgroundColor: isPast ? 'primary.main' : 'grey.500'
            }
          : {}
    }

    return (
      <Box key={step} sx={stepStyle}>
        <Box
          sx={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: isCurrent || isPast ? 'primary.main' : 'grey.500',
            color: '#fff',
            mb: 1
          }}
        >
          <Typography
            variant="caption"
            color={isCurrent || isPast ? 'primary.contrastText' : 'inherit'}
          >
            {index + 1}
          </Typography>
        </Box>
        <Typography
          color={isCurrent || isPast ? 'primary.main' : 'inherit'}
          variant="body3"
        >
          {step}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
      <Breadcrumbs
        aria-label="Breadcrumb Progress"
        separator=""
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'nowrap',
          justifyContent: isSmallScreen ? 'space-around' : 'flex-start'
        }}
      >
        {steps.map(renderStep)}
      </Breadcrumbs>
    </Box>
  )
}

ProgressBreadcrumb.propTypes = {
  steps: PropTypes.array,
  currentStep: PropTypes.string
}

export default ProgressBreadcrumb
