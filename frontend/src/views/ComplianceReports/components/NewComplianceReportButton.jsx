import { useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { Menu, MenuItem, Box } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCaretDown,
  faCaretUp,
  faCirclePlus,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import {
  useGetOrgComplianceReportReportedYears,
  useOrgEarlyIssuance
} from '@/hooks/useOrganization'
import { isFeatureEnabled, FEATURE_FLAGS } from '@/constants/config'

export const NewComplianceReportButton = forwardRef((props, ref) => {
  const { handleNewReport, isButtonLoading, setIsButtonLoading } = props
  const { data: periods, isLoading, isFetched } = useCompliancePeriod()
  const { data: reportedPeriods } = useGetOrgComplianceReportReportedYears()
  const { data: earlyIssuance2026 } = useOrgEarlyIssuance('2026')
  const { t } = useTranslation(['common', 'report'])

  const is2025Enabled = isFeatureEnabled(FEATURE_FLAGS.REPORTING_2025_ENABLED)
  // 2026 is available if 2025 is enabled OR if the org has early issuance for 2026
  const is2026Available = is2025Enabled || earlyIssuance2026?.hasEarlyIssuance

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

  const filteredDates = () => {
    const currentYear = new Date().getFullYear()

    // Handle both possible data structures safely
    const periodsArray = periods?.data || periods || []
    return periodsArray.filter((item) => {
      const effectiveYear = new Date(item.effectiveDate).getFullYear()
      return effectiveYear <= currentYear && effectiveYear >= 2024
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
              disabled={
                reportedPeriodIDs?.includes(period.compliancePeriodId) ||
                (period.description === '2025' && !is2025Enabled) ||
                (period.description === '2026' && !is2026Available)
              }
              className={`compliance-period-${period.description}`}
            >
              {period.description}
            </MenuItem>
          ))}
          {/* Show info message when reporting periods are disabled */}
          {(!is2025Enabled || !is2026Available) && (
            <Box
              sx={{
                px: 2,
                py: 1,
                borderTop: '1px solid #e0e0e0',
                backgroundColor: '#f5f5f5',
                cursor: 'default'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  style={{
                    fontSize: '0.875rem',
                    color: '#666',
                    marginRight: '4px'
                  }}
                />
                <BCTypography variant="caption" color="text.secondary">
                  {!is2025Enabled && !is2026Available
                    ? '2025 and 2026 reporting are temporarily unavailable due to regulatory updates'
                    : !is2025Enabled
                      ? '2025 reporting is temporarily unavailable due to regulatory updates'
                      : '2026 reporting is temporarily unavailable due to regulatory updates'}
                </BCTypography>
              </Box>
            </Box>
          )}
        </Menu>
      )}
    </div>
  )
})

NewComplianceReportButton.displayName = 'NewComplianceReportButton'
