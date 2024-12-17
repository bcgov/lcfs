
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import {
  useGetAllOtherUses,
  useOtherUsesOptions,
  useSaveOtherUses
} from '@/hooks/useOtherUses'
import { cleanEmptyStringValues } from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  defaultColDef,
  otherUsesColDefs,
  PROVISION_APPROVED_FUEL_CODE
} from './_schema'
import * as ROUTES from '@/constants/routes/routes.js'

export const AddEditOtherUses = () => {
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'otherUses', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useOtherUsesOptions()
  const { data: otherUses, isLoading: usesLoading } =
    useGetAllOtherUses(complianceReportId)
  const { mutateAsync: saveRow } = useSaveOtherUses({ complianceReportId })
  const navigate = useNavigate()

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

  const onGridReady = (params) => {
    const ensureRowIds = (rows) => {
      return rows.map((row) => {
        if (!row.id) {
          return {
            ...row,
            complianceReportId, // This takes current reportId, important for versioning
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
      const id = uuid()
      const emptyRow = { id, complianceReportId }
      setRowData([emptyRow])
    }

    params.api.sizeColumnsToFit()

    setTimeout(() => {
      const lastRowIndex = params.api.getLastDisplayedRowIndex()

      params.api.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'fuelType'
      })
    }, 100)
  }

  const onAction = async (action, params) => {
    alertRef.current?.triggerAlert({
      message: 'Row updating',
      severity: 'pending'
    })

    if (action === 'delete') {
      const updatedRow = { ...params.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.otherUsesId) {
        try {
          await saveRow(updatedRow)
          alertRef.current?.triggerAlert({
            message: 'Row deleted successfully.',
            severity: 'success'
          })
        } catch (error) {
          alertRef.current?.triggerAlert({
            message: `Error deleting row: ${error.message}`,
            severity: 'error'
          })
        }
      }
    }
  }

  const onCellValueChanged = useCallback(
    async (params) => {
      if (
        ['fuelType', 'fuelCode', 'provisionOfTheAct'].includes(
          params.colDef.field
        )
      ) {
        const ciOfFuel = findCiOfFuel(params.data, optionsData)
        params.node.setDataValue('ciOfFuel', ciOfFuel)

        // Auto-populate fields based on the selected fuel type
        if (params.colDef.field === 'fuelType') {
          const fuelType = optionsData?.fuelTypes?.find(
            (obj) => params.data.fuelType === obj.fuelType
          );
          if (fuelType) {
            // Auto-populate the "units" field
            if (fuelType.units) {
              params.node.setDataValue('units', fuelType.units);
            } else {
              params.node.setDataValue('units', '');
            }

            // Auto-populate the "fuelCategory" field
            const fuelCategoryOptions = fuelType.fuelCategories.map(
              (item) => item.category
            );
            params.node.setDataValue('fuelCategory', fuelCategoryOptions[0] ?? null);

            // Auto-populate the "fuelCode" field
            const fuelCodeOptions = fuelType.fuelCodes.map(
              (code) => code.fuelCode
            );
            params.node.setDataValue('fuelCode', fuelCodeOptions[0] ?? null);
            params.node.setDataValue(
              'fuelCodeId',
              fuelType.fuelCodes[0]?.fuelCodeId ?? null
            );
          }
        }
      }
    },
    [optionsData, findCiOfFuel]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return
      params.data.complianceReportId = complianceReportId
      params.data.validationStatus = 'pending'

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = cleanEmptyStringValues(params.data)

      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      if (isFuelCodeScenario && !updatedData.fuelCode) {
        // Fuel code is required but not provided
        setErrors((prevErrors) => ({
          ...prevErrors,
          [params.node.data.id]: ['fuelCode']
        }))

        alertRef.current?.triggerAlert({
          message: t('otherUses:fuelCodeFieldRequiredError'),
          severity: 'error'
        })

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        params.node.updateData(updatedData)
        return // Stop execution, do not proceed to save
      }

      try {
        setErrors({})
        await saveRow(updatedData)
        updatedData = {
          ...updatedData,
          validationStatus: 'success',
          modified: false
        }
        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })
      } catch (error) {
        setErrors({
          [params.node.data.id]: error.response.data.errors[0].fields
        })

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const { fields, message } = error.response.data.errors[0]
          const fieldLabels = fields.map((field) =>
            t(`otherUses:otherUsesColLabels.${field}`)
          )
          const errMsg = `Error updating row: ${
            fieldLabels.length === 1 ? fieldLabels[0] : ''
          } ${message}`

          alertRef.current?.triggerAlert({
            message: errMsg,
            severity: 'error'
          })
        } else {
          alertRef.current?.triggerAlert({
            message: `Error updating row: ${error.message}`,
            severity: 'error'
          })
        }
      }

      params.node.updateData(updatedData)
    },
    [complianceReportId, saveRow, t]
  )

  const handleNavigateBack = useCallback(() => {
    navigate(
      ROUTES.REPORTS_VIEW.replace(
        ':compliancePeriod',
        compliancePeriod
      ).replace(':complianceReportId', complianceReportId)
    )
  }, [navigate, compliancePeriod, complianceReportId])

  if (optionsLoading || usesLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-other-uses-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('otherUses:newOtherUsesTitle')}
          </BCTypography>
        </div>

        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          getRowId={(params) => params.data.id}
          columnDefs={otherUsesColDefs(optionsData, errors)}
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
        />
      </Grid2>
    )
  )
}
