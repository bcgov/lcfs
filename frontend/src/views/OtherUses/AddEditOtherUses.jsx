import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ROUTES, buildPath } from '@/routes/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetAllOtherUsesList,
  useOtherUsesOptions,
  useSaveOtherUses
} from '@/hooks/useOtherUses'
import { isArrayEmpty } from '@/utils/array'
import { cleanEmptyStringValues } from '@/utils/formatters'
import { changelogRowStyle } from '@/utils/grid/changelogCellStyle'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  defaultColDef,
  otherUsesColDefs,
  PROVISION_APPROVED_FUEL_CODE
} from './_schema'

export const AddEditOtherUses = () => {
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'otherUses', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useOtherUsesOptions({ compliancePeriod })

  const { mutateAsync: saveRow } = useSaveOtherUses(complianceReportId)
  const navigate = useNavigate()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const { data: complianceReport, isLoading: complianceReportLoading } =
    useGetComplianceReport(
      currentUser?.organization?.organizationId,
      complianceReportId
    )
  const isSupplemental = complianceReport?.report?.version !== 0

  const { data: otherUses, isLoading: usesLoading } = useGetAllOtherUsesList({
    complianceReportId,
    changelog: isSupplemental
  })

  useEffect(() => {
    if (location.state?.message) {
      alertRef.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  // If otherUses data is available, set the rowData
  useEffect(() => {
    if (otherUses && otherUses.length > 0) {
      const ensureRowIds = (rows) =>
        rows.map((row) => ({
          ...row,
          id: row.id || uuid(),
          isValid: true
        }))

      setRowData(ensureRowIds(otherUses))
    }
  }, [otherUses])

  useEffect(() => {
    if (!usesLoading && !isArrayEmpty(otherUses)) {
      const updatedRowData = otherUses.map((item) => ({
        ...item,
        complianceReportId,
        isNewSupplementalEntry:
          isSupplemental && item.complianceReportId === +complianceReportId
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
    }
  }, [
    compliancePeriod,
    complianceReportId,
    isSupplemental,
    otherUses,
    usesLoading
  ])

  const findCiOfFuel = useCallback((data, optionsData) => {
    let ciOfFuel = 0
    if (data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => data.fuelType === obj.fuelType
      )
      const fuelCode = fuelType?.fuelCodes?.find(
        (item) => item.fuelCode === data.fuelCode
      )
      ciOfFuel = fuelCode?.carbonIntensity || 0
    } else {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => data.fuelType === obj.fuelType
      )
      ciOfFuel = fuelType?.defaultCarbonIntensity || 0
    }
    return ciOfFuel
  }, [])

  const validate = (
    params,
    validationFn,
    errorMessage,
    alertRef,
    field = null
  ) => {
    const value = field ? params.node?.data[field] : params

    if (field && params.colDef.field !== field) {
      return true
    }

    if (!validationFn(value)) {
      alertRef.current?.triggerAlert({
        message: errorMessage,
        severity: 'error'
      })
      return false
    }
    return true // Proceed with the update
  }

  const onGridReady = useCallback(
    (params) => {
      const ensureRowIds = (rows) => {
        return rows.map((row) => {
          if (!row.id) {
            return {
              ...row,
              complianceReportId, // This takes current reportId, important for versioning
              isNewSupplementalEntry:
                isSupplemental &&
                row.complianceReportId === +complianceReportId,
              id: uuid(),
              isValid: true
            }
          }
          return row
        })
      }

      if (otherUses && otherUses.length > 0) {
        try {
          setRowData([
            ...ensureRowIds(otherUses),
            { id: uuid(), complianceReportId }
          ])
        } catch (error) {
          alertRef.triggerAlert({
            message: t('otherUses:otherUsesLoadFailMsg'),
            severity: 'error'
          })
        }
      } else {
        setRowData([{ id: uuid, complianceReportId }])
      }

      params.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()

        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'fuelType'
        })
      }, 100)
    },
    [complianceReportId, isSupplemental, otherUses, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete' || action === 'undo') {
      await handleScheduleDelete(
        params,
        'otherUsesId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId
        }
      )
    }
  }

  const onCellValueChanged = useCallback(
    async (params) => {
      if (
        ['fuelType', 'fuelCode', 'provisionOfTheAct'].includes(
          params.colDef.field
        )
      ) {
        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )

        if (!fuelType) {
          return
        }

        const ciOfFuel = findCiOfFuel(params.data, optionsData)
        params.node.setDataValue('ciOfFuel', ciOfFuel)

        // Auto-populate fields based on the selected fuel type
        if (params.colDef.field === 'fuelType') {
          // Auto-populate the "units" field
          if (fuelType.units) {
            params.node.setDataValue('units', fuelType.units)
          } else {
            params.node.setDataValue('units', '')
          }

          // Auto-populate the "fuelCategory" field
          const fuelCategoryOptions = fuelType.fuelCategories.map(
            (item) => item.category
          )

          const categoryValue =
            fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null

          params.node.setDataValue('fuelCategory', categoryValue)

          // Auto populate the "provisionOfTheAct" field
          const provisions = fuelType.provisionOfTheAct.map(
            (provision) => provision.name
          )

          const provisionValue = provisions.length === 1 ? provisions[0] : null
          params.node.setDataValue('provisionOfTheAct', provisionValue)
        }

        const isFuelCodeScenario =
          params.node.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE

        // Auto-populate the "fuelCode" field
        if (isFuelCodeScenario) {
          const fuelCodeOptions = fuelType.fuelCodes.map(
            (code) => code.fuelCode
          )
          if (fuelCodeOptions.length === 1) {
            params.node.setDataValue('fuelCode', fuelCodeOptions[0] ?? null)
            params.node.setDataValue(
              'fuelCodeId',
              fuelType.fuelCodes[0]?.fuelCodeId ?? null
            )
          }
        }
      }
    },
    [optionsData, findCiOfFuel]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      const isValid = validate(
        params,
        (value) => {
          return value !== null && !isNaN(value) && value > 0
        },
        'Quantity supplied must be greater than 0.',
        alertRef,
        'quantitySupplied'
      )

      if (!isValid) {
        return
      }

      params.data.complianceReportId = complianceReportId
      params.data.validationStatus = 'pending'

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = cleanEmptyStringValues(params.data)

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'otherUsesId',
        labelPrefix: 'otherUses:otherUsesColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      params.node.updateData(updatedData)
    },
    [complianceReportId, saveRow, t]
  )

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      })
    )
  }, [navigate, compliancePeriod, complianceReportId])

  if (optionsLoading || usesLoading) {
    return <Loading />
  }

  return (
    isFetched &&
    !usesLoading &&
    !currentUserLoading &&
    !complianceReportLoading && (
      <Grid2 className="add-edit-other-uses-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('otherUses:newOtherUsesTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('otherUses:newOtherUsesGuide')}
          </BCTypography>
        </div>

        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          getRowId={(params) => params.data.id}
          columnDefs={otherUsesColDefs(
            optionsData,
            errors,
            warnings,
            isSupplemental
          )}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          overlayNoRowsTemplate={t('otherUses:noOtherUsesFound')}
          loading={optionsLoading || usesLoading}
          onAction={onAction}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStopped={onCellEditingStopped}
          showAddRowsButton
          stopEditingWhenCellsLoseFocus
          saveButtonProps={{
            enabled: true,
            text: t('report:saveReturn'),
            onSave: handleNavigateBack,
            confirmText: t('report:incompleteReport'),
            confirmLabel: t('report:returnToReport')
          }}
          gridOptions={{
            getRowStyle: (params) => changelogRowStyle(params, isSupplemental)
          }}
        />
      </Grid2>
    )
  )
}
