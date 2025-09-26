import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import { Grid2 } from '@mui/material'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'

export const FinalSupplyEquipmentReporting = () => {
  const { t } = useTranslation()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [isGridReady, setGridReady] = useState(true)
  const dateGridRef = useRef(null)
  const dateGridAlertRef = useRef(null)

  const { complianceReportId, compliancePeriod } = useParams()

  // Initialize react-hook-form
  const form = useForm({
    defaultValues: {
      supplyDateRange: [null, null]
    }
  })

  const { watch } = form
  const supplyDateRange = watch('supplyDateRange')

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound'
      ),
      stopEditingWhenCellsLoseFocus: false,
      autoSizeStrategy: {
        type: 'fitGridWidth',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      }
    }),
    [t]
  )

  const onGridReady = () => {
    setGridReady(true)
  }

  const onFirstDataRendered = useCallback((params) => {
    params.api?.autoSizeAllColumns?.()
  }, [])

  // Handle date range changes
  const handleDateRangeChange = useCallback((dateRange) => {
    // You can add additional logic here when the date range changes
    // For example, filtering grid data, making API calls, etc.
    console.log('Date range changed:', dateRange)
  }, [])

  return (
    <Grid2 className="fse-reporting-container" size={12} container spacing={2}>
      <BCBox
        className="fse-header-container"
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <BCTypography variant="h5" color="primary" className="fse-header-title">
          {t('finalSupplyEquipment:fseReportingTitle')}
        </BCTypography>
        <BCTypography variant="body4" color="text" className="fse-header-desc">
          {t('finalSupplyEquipment:fseReportingDesc')}
        </BCTypography>
      </BCBox>

      <BCBox
        className="fse-date-container"
        sx={{ height: '100%', width: '50%' }}
      ></BCBox>
    </Grid2>
  )
}
FinalSupplyEquipmentReporting.displayName = 'FinalSupplyEquipmentReporting'
