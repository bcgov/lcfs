import { useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import { Menu, MenuItem } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCaretDown,
  faCaretUp,
  faCirclePlus
} from '@fortawesome/free-solid-svg-icons'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useGetOrgComplianceReportReportedYears } from '@/hooks/useOrganization'

export const NewComplianceReportButton = forwardRef((props, ref) => {
  const { handleNewReport, isButtonLoading, setIsButtonLoading } = props
  const { data: periods, isLoading, isFetched } = useCompliancePeriod()
  const { data: reportedPeriods } = useGetOrgComplianceReportReportedYears()
  const { t } = useTranslation(['common', 'report'])

  const reportedPeriodIDs = reportedPeriods?.map((p) => p.compliancePeriodId)

  const [anchorEl, setAnchorEl] = useState(null)

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleComplianceOptionClick = (option) => {
    handleClose()
    setIsButtonLoading(true)
    handleNewReport(option)
  }

  const isMenuOpen = Boolean(anchorEl)

  // Temporarily disable future year compliance reports
  // const filteredDates = () => {
  //   const currentYear = new Date().getFullYear()
  //   const yearAhead = currentYear + 1
  //   return periods?.data.filter((item) => {
  //     const effectiveYear = new Date(item.effectiveDate).getFullYear()
  //     return effectiveYear <= yearAhead && effectiveYear >= 2024
  //   })
  // }

  const filteredDates = () => {
    return periods?.data.filter((item) => {
      const effectiveYear = new Date(item.effectiveDate).getFullYear()
      return effectiveYear >= 2018
    })
  }

  return (
    <div>
      <BCButton
        ref={ref}
        isLoading={isLoading || isButtonLoading}
        variant="contained"
        size="small"
        color="primary"
        className="new-compliance-report-button"
        startIcon={
          <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
        }
        endIcon={
          <FontAwesomeIcon
            icon={isMenuOpen ? faCaretUp : faCaretDown}
            className="small-icon"
          />
        }
        onClick={handleClick}
      >
        {t('report:newReportBtn')}
      </BCButton>

      {isFetched && !isButtonLoading && anchorEl && (
        <Menu
          sx={{
            '.MuiMenu-list': { py: 0 },
            '& .MuiPaper-root': {
              maxWidth: 'none !important' // explicitly remove max-width limitation of mui default
            }
          }}
          anchorEl={anchorEl}
          open={isMenuOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              style: {
                width: anchorEl.getBoundingClientRect().width - 8,
                maxHeight: '10rem',
                overflowY: 'auto'
              }
            }
          }}
        >
          {filteredDates().map((period) => (
            <MenuItem
              key={period.compliancePeriodId}
              onClick={() => handleComplianceOptionClick(period)}
              disabled={reportedPeriodIDs?.includes(period.compliancePeriodId)}
              className={`compliance-period-${period.description}`}
            >
              {period.description}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  )
})

NewComplianceReportButton.displayName = 'NewComplianceReportButton'
