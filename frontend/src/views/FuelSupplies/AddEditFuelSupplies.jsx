import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { DEFAULT_CI_FUEL } from '@/constants/common'
import * as ROUTES from '@/constants/routes/routes.js'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { isArrayEmpty, cleanEmptyStringValues } from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  defaultColDef,
  fuelSupplyColDefs,
  PROVISION_APPROVED_FUEL_CODE
} from './_schema'
import { handleScheduleSave } from '@/utils/schedules.js'

export const AddEditFuelSupplies = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelSupply', 'reports'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelSupplyOptions({ compliancePeriod })

  const { mutateAsync: saveRow } = useSaveFuelSupply({ complianceReportId })

  const { data, isLoading: fuelSuppliesLoading } =
    useGetFuelSupplies(complianceReportId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      }
    }),
    [t]
  )

  useEffect(() => {
    if (location?.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location?.state?.message, location?.state?.severity])

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
    async (params) => {
      setGridApi(params.api)
      if (!isArrayEmpty(data)) {
        const updatedRowData = data.fuelSupplies.map((item) => ({
          ...item,
          complianceReportId, // This takes current reportId, important for versioning
          compliancePeriod,
          fuelCategory: item.fuelCategory?.category,
          fuelType: item.fuelType?.fuelType,
          fuelTypeOther:
            item.fuelType?.fuelType === 'Other' ? item.fuelTypeOther : null,
          provisionOfTheAct: item.provisionOfTheAct?.name,
          provisionOfTheActId: item.provisionOfTheActId,
          fuelCode: item.fuelCode?.fuelCode,
          endUse: item.endUse?.type,
          id: uuid()
        }))
        setRowData([...updatedRowData, { id: uuid() }])
      } else {
        setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
      }
      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'fuelType'
        })
      }, 100)
    },
    [data, complianceReportId, compliancePeriod]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelSupplyColDefs(optionsData, errors, warnings)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, warnings, optionsData])

  useEffect(() => {
    if (!fuelSuppliesLoading && !isArrayEmpty(data)) {
      const updatedRowData = data.fuelSupplies.map((item) => ({
        ...item,
        complianceReportId, // This takes current reportId, important for versioning
        compliancePeriod,
        fuelCategory: item.fuelCategory?.category,
        fuelType: item.fuelType?.fuelType,
        fuelTypeOther:
          item.fuelType?.fuelType === 'Other' ? item.fuelTypeOther : null,
        provisionOfTheAct: item.provisionOfTheAct?.name,
        provisionOfTheActId: item.provisionOfTheAct?.provisionOfTheActId,
        fuelCode: item.fuelCode?.fuelCode,
        endUse: item.endUse?.type,
        id: uuid()
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
    }
  }, [data, fuelSuppliesLoading, complianceReportId, compliancePeriod])

  const onCellValueChanged = useCallback(
    async (params) => {
      setWarnings({})
      if (params.column.colId === 'fuelType') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.node.data.fuelType === obj.fuelType
        )
        if (selectedFuelType) {
          const fuelCategoryOptions = selectedFuelType.fuelCategories.map(
            (item) => item.fuelCategory
          )

          const endUseTypes = selectedFuelType.eerRatios.map(
            (item) => item.endUseType
          )

          // Set to null if multiple options, otherwise use first item
          const categoryValue =
            fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0].type : null

          params.node.setDataValue('fuelCategory', categoryValue)
          params.node.setDataValue('endUseType', endUseValue)

          // Reset provisionOfTheAct and provisionOfTheActId fields
          if (selectedFuelType.provisions.length === 1) {
            params.node.setDataValue(
              'provisionOfTheAct',
              selectedFuelType.provisions[0].name
            )
            params.node.setDataValue(
              'provisionOfTheActId',
              selectedFuelType.provisions[0].provisionOfTheActId
            )
          } else {
            params.node.setDataValue('provisionOfTheAct', null)
            params.node.setDataValue('provisionOfTheActId', null)
          }
        }
      }

      if (params.column.colId === 'fuelCategory') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.node.data.fuelType === obj.fuelType
        )

        if (selectedFuelType) {
          const endUseTypes = selectedFuelType.eerRatios
            .filter(
              (item) =>
                item.fuelCategory.fuelCategory === params.data.fuelCategory
            )
            .map((item) => item.endUseType)

          // Set to null if multiple options, otherwise use first item
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0].type : null

          params.node.setDataValue('endUseType', endUseValue)

          if (selectedFuelType.provisions.length === 1 &&
            !params.node.data.provisionOfTheAct
          ) {
            params.node.setDataValue(
              'provisionOfTheAct',
              selectedFuelType.provisions[0].name
            )
            params.node.setDataValue(
              'provisionOfTheActId',
              selectedFuelType.provisions[0].provisionOfTheActId
            )
          } else {
            params.node.setDataValue('provisionOfTheAct', null)
            params.node.setDataValue('provisionOfTheActId', null)
          }
        }
      }
    },
    [optionsData]
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
        'quantity'
      )

      if (!isValid) {
        return
      }

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = cleanEmptyStringValues(params.node.data)

      if (updatedData.fuelType === 'Other') {
        updatedData.ciOfFuel = DEFAULT_CI_FUEL[updatedData.fuelCategory]
      }

      const isFuelCodeScenario =
        params.node.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      if (isFuelCodeScenario && !params.node.data.fuelCode) {
        // Set error on the row
        setErrors({
          [params.node.data.id]: ['fuelCode']
        })

        alertRef.current?.triggerAlert({
          message: t('fuelSupply:fuelCodeFieldRequiredError'),
          severity: 'error'
        })

        // Update node data to reflect error state
        params.node.updateData({
          ...params.node.data,
          validationStatus: 'error'
        })
        return // Stop saving further
      }

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'fuelSupplyId',
        labelPrefix: 'fuelSupply:fuelSupplyColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      params.node.updateData(updatedData)
    },
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      const updatedRow = { ...params.node.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.fuelSupplyId) {
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

  const handleNavigateBack = useCallback(() => {
    navigate(
      ROUTES.REPORTS_VIEW.replace(
        ':compliancePeriod',
        compliancePeriod
      ).replace(':complianceReportId', complianceReportId)
    )
  }, [navigate, compliancePeriod, complianceReportId])

  return (
    isFetched &&
    !fuelSuppliesLoading && (
      <Grid2 className="add-edit-fuel-supply-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('fuelSupply:fuelSupplyTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('fuelSupply:fuelSupplyGuide')}
          </BCTypography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            gridOptions={gridOptions}
            loading={optionsLoading || fuelSuppliesLoading}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            stopEditingWhenCellsLoseFocus
            saveButtonProps={{
              enabled: true,
              text: t('report:saveReturn'),
              onSave: handleNavigateBack,
              confirmText: t('report:incompleteReport'),
              confirmLabel: t('report:returnToReport')
            }}
          />
        </BCBox>
      </Grid2>
    )
  )
}
