import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import { ROUTES, buildPath } from '@/routes/routes'
import {
  useFuelExportOptions,
  useGetFuelExportsList,
  useSaveFuelExport
} from '@/hooks/useFuelExport'
import { isArrayEmpty } from '@/utils/array.js'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelExportColDefs } from './_schema'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'

export const AddEditFuelExports = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)

  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [gridReady, setGridReady] = useState(false)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelExport'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()
  const { data: currentReport, isLoading } =
    useComplianceReportWithCache(complianceReportId)

  const isSupplemental = currentReport?.report?.version !== 0

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelExportOptions({ compliancePeriod })
  const { mutateAsync: saveRow } = useSaveFuelExport({ complianceReportId })

  const { data, isLoading: fuelExportsLoading } = useGetFuelExportsList({
    complianceReportId,
    changelog: isSupplemental
  })

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelExport:noFuelExportsFound'),
      stopEditingWhenCellsLoseFocus: false,
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      }
    }),
    [isSupplemental, t]
  )

  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  const onGridReady = useCallback(
    async (params) => {
      if (!isArrayEmpty(data)) {
        const updatedRowData = data.fuelExports.map((item) => ({
          ...item,
          ciOfFuel: item.ciOfFuel,
          complianceReportId,
          compliancePeriod,
          fuelCategory: item.fuelCategory?.category,
          fuelType: item.fuelType?.fuelType,
          provisionOfTheAct: item.provisionOfTheAct?.name,
          fuelCode: item.fuelCode?.fuelCode,
          endUse: item.endUse?.type,
          isNewSupplementalEntry:
            isSupplemental && item.complianceReportId === +complianceReportId,
          id: uuid()
        }))
        setRowData([
          ...updatedRowData,
          { id: uuid(), complianceReportId, compliancePeriod }
        ])
      } else {
        setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
      }
      params.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'fuelTypeId'
        })
        setGridReady(true)
      }, 500)
    },
    [compliancePeriod, complianceReportId, data, isSupplemental]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelExportColDefs(
        optionsData,
        errors,
        warnings,
        gridReady,
        isSupplemental
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [optionsData, errors, warnings, gridReady, isSupplemental])

  useEffect(() => {
    if (!fuelExportsLoading && !isArrayEmpty(data)) {
      const updatedRowData = data.fuelExports.map((item) => ({
        ...item,
        complianceReportId,
        compliancePeriod,
        fuelCategory: item.fuelCategory?.category,
        fuelType: item.fuelType?.fuelType,
        provisionOfTheAct: item.provisionOfTheAct?.name,
        fuelCode: item.fuelCode?.fuelCode,
        endUse: item.endUse?.type,
        isNewSupplementalEntry:
          isSupplemental && item.complianceReportId === +complianceReportId,
        id: uuid()
      }))
      setRowData([
        ...updatedRowData,
        { id: uuid(), complianceReportId, compliancePeriod }
      ])
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
    }
  }, [
    compliancePeriod,
    complianceReportId,
    data,
    fuelExportsLoading,
    isSupplemental
  ])

  const onCellValueChanged = useCallback(
    async (params) => {
      if (params.column.colId === 'fuelTypeId') {
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
          const category =
            fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0].type : null
          const provisionValue =
            selectedFuelType.provisions.length === 1
              ? selectedFuelType.provisions[0].name
              : null

          params.node.setDataValue('fuelCategory', category)
          params.node.setDataValue('endUseType', endUseValue)
          params.node.setDataValue('provisionOfTheAct', provisionValue)
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
          const provisionValue =
            selectedFuelType.provisions.length === 1
              ? selectedFuelType.provisions[0].name
              : null

          params.node.setDataValue('endUseType', endUseValue)
          params.node.setDataValue('provisionOfTheAct', provisionValue)
        }
      }

      const recalcFields = [
        'fuelTypeId',
        'fuelCategory',
        'provisionOfTheAct',
        'fuelCode',
        'exportDate'
      ]

      if (recalcFields.includes(params.column.colId)) {
        // remove the stored value so the getter recalculates
        params.node.setDataValue('ciOfFuel', null)

        // refresh the CI columns for immediate feedback
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: ['ciOfFuel', 'targetCi', 'uci', 'complianceUnits']
        })
      }
    },
    [optionsData]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      updatedData.compliancePeriod = compliancePeriod

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'fuelExportId',
        labelPrefix: 'fuelExport:fuelExportColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      updatedData = {
        ...updatedData,
        fuelType: updatedData.fuelType?.fuelType ?? updatedData.fuelType,
        fuelCategory:
          updatedData.fuelCategory?.category ?? updatedData.fuelCategory,
        provisionOfTheAct:
          updatedData.provisionOfTheAct?.name ?? updatedData.provisionOfTheAct,
        fuelCode: updatedData.fuelCode?.fuelCode ?? updatedData.fuelCode,
        endUseType: updatedData.endUse?.type ?? updatedData.endUseType
      }

      params.node.updateData(updatedData)
    },
    [saveRow, t, compliancePeriod]
  )

  const onAction = async (action, params) => {
    if (action === 'delete' || action === 'undo') {
      await handleScheduleDelete(
        params,
        'fuelExportId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId,
          compliancePeriod
        }
      )
    }
  }

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      }),
      {
        state: {
          expandedSchedule: 'fuelExports',
          message: t('fuelExport:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  return (
    isFetched &&
    !fuelExportsLoading &&
    !isLoading && (
      <Grid2 className="add-edit-fuel-export-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('fuelExport:addFuelExportRowsTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('fuelExport:fuelExportGuide')}
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
            loading={optionsLoading || fuelExportsLoading}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            showAddRowsButton={true}
            context={{ errors }}
            onAction={onAction}
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
