import { useState, useRef } from 'react'
// mui components
import BCButton from '@/components/BCButton'
import { Menu, MenuItem } from '@mui/material'
// Icons
import {
  faCaretUp,
  faCaretDown,
  faCirclePlus
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// hooks
import { useTranslation } from 'react-i18next'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'

export const NewComplianceReportButton = ({ handleNewReport }) => {
  const { data: periods, isLoading, isFetched } = useCompliancePeriod()
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
    handleNewReport(option)
  }

  const isMenuOpen = Boolean(anchorEl)

  return (
    <div>
      <BCButton
        ref={buttonRef}
        isLoading={isLoading}
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
        loadingPosition="start"
      >
        {t('report:newReportBtn')}
      </BCButton>
      {isFetched && (
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
          {periods?.data?.map((period) => (
            <MenuItem
              key={period.compliancePeriodId}
              onClick={() => handleComplianceOptionClick(period)}
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
