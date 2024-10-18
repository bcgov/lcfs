import BCButton from '@/components/BCButton'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useGetOrgComplianceReportReportedYears } from '@/hooks/useOrganization'
import {
  faCaretDown,
  faCaretUp,
  faCirclePlus
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Menu, MenuItem } from '@mui/material'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const NewComplianceReportButton = ({
  handleNewReport,
  isButtonLoading,
  setIsButtonLoading
}) => {
  const { data: periods, isLoading, isFetched } = useCompliancePeriod()
  const { data: reportedPeriods } = useGetOrgComplianceReportReportedYears(1)

  const reportedPeriodIDs = reportedPeriods?.map(
    (period) => period.compliancePeriodId
  )

  const [anchorEl, setAnchorEl] = useState(null)
  const buttonRef = useRef(null)
  const { t } = useTranslation(['common', 'report'])

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleComplianceOptionClick = (option) => {
    setAnchorEl(null)
    setIsButtonLoading(true)
    handleNewReport(option)
  }

  const isMenuOpen = Boolean(anchorEl)

  const filteredDates = () => {
    const currentYear = new Date().getFullYear()
    const yearAhead = currentYear + 1
    return periods?.data.filter((item) => {
      const effectiveYear = new Date(item.effectiveDate).getFullYear()
      return effectiveYear <= yearAhead && effectiveYear >= currentYear
    })
  }

  return (
    <div>
      <BCButton
        ref={buttonRef}
        isLoading={isLoading || isButtonLoading}
        variant="contained"
        size="small"
        color="primary"
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
      {isFetched && !isButtonLoading && (
        <Menu
          sx={{ '.MuiMenu-list': { py: 0 } }}
          anchorEl={anchorEl}
          open={isMenuOpen}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left'
          }}
          slotProps={{
            paper: {
              style: {
                width: buttonRef.current?.offsetWidth,
                maxHeight: '10rem',
                overflowY: 'scroll'
              }
            }
          }}
        >
          {filteredDates().map((period) => (
            <MenuItem
              key={period.compliancePeriodId}
              onClick={() => handleComplianceOptionClick(period)}
              disabled={reportedPeriodIDs?.includes(period.compliancePeriodId)}
            >
              {period.description}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  )
}

NewComplianceReportButton.displayName = 'NewComplianceReportButton'
