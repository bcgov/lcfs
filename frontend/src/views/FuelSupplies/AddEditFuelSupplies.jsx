import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, fuelSupplyColDefs } from './_schema'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { v4 as uuid } from 'uuid'
import * as ROUTES from '@/constants/routes/routes.js'
import { isArrayEmpty } from '@/utils/formatters'

export const AddEditFuelSupplies = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [gridApi, setGridApi] = useState()
  const [errors, setErrors] = useState({})
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
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  const onGridReady = useCallback(
    async (params) => {
      setGridApi(params.api)
      if (!isArrayEmpty(data)) {
        const updatedRowData = data.fuelSupplies.map((item) => ({
          ...item,
          fuelCategory: item.fuelCategory?.category,
          fuelType: item.fuelType?.fuelType,
          provisionOfTheAct: item.provisionOfTheAct?.name,
          fuelCode: item.fuelCode?.fuelCode,
          endUse: item.endUse?.type || 'Any',
          id: uuid()
        }))
        setRowData(updatedRowData)
      } else {
        setRowData([{ id: uuid() }])
      }
    },
    [data]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelSupplyColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData])

  useEffect(() => {
    if (!fuelSuppliesLoading && !isArrayEmpty(data)) {
      const updatedRowData = data.fuelSupplies.map((item) => ({
        ...item,
        fuelCategory: item.fuelCategory?.category,
        fuelType: item.fuelType?.fuelType,
        provisionOfTheAct: item.provisionOfTheAct?.name,
        fuelCode: item.fuelCode?.fuelCode,
        endUse: item.endUse?.type || 'Any',
        id: uuid()
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid() }])
    }
  }, [data, fuelSuppliesLoading])

  const onCellValueChanged = useCallback(
    async (params) => {
      if (params.column.colId === 'fuelType') {
        const options = optionsData?.fuelTypes
          ?.find((obj) => params.node.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.fuelCategory)
        if (options.length === 1) {
          params.node.setDataValue('fuelCategory', options[0])
        }
      }
      if (
        params.column.colId === 'quantity' &&
        params.node.data.fuelType &&
        params.node.data.fuelCategory &&
        params.node.data.provisionOfTheAct
      ) {
        const energyDensity =
          params.node.data.energyDensity ||
          optionsData?.fuelTypes?.find(
            (obj) => params.node.data.fuelType === obj.fuelType
          )?.energyDensity.energyDensity
        const targetCi =
          optionsData?.fuelTypes
            ?.find((obj) => params.node.data.fuelType === obj.fuelType)
            ?.targetCarbonIntensities.find(
              (item) =>
                item.fuelCategory.fuelCategory === params.node.data.fuelCategory
            )?.targetCarbonIntensity || 0
        const effectiveCarbonIntensity = /Fuel code/i.test(
          params.node.data.determiningCarbonIntensity
        )
          ? optionsData?.fuelTypes
              ?.find((obj) => params.node.data.fuelType === obj.fuelType)
              ?.fuelCodes.find(
                (item) => item.fuelCode === params.node.data.fuelCode
              )?.fuelCodeCarbonIntensity
          : optionsData &&
            optionsData?.fuelTypes?.find(
              (obj) => params.node.data.fuelType === obj.fuelType
            )?.defaultCarbonIntensity
        const eerOptions = optionsData?.fuelTypes?.find(
          (obj) => params.node.data.fuelType === obj.fuelType
        )
        let eer =
          eerOptions &&
          eerOptions?.eerRatios.find(
            (item) =>
              item.fuelCategory.fuelCategory ===
                params.node.data.fuelCategory &&
              item.endUseType?.type === params.node.data.endUse
          )?.energyEffectivenessRatio
        if (!eer) {
          eer = eerOptions?.eerRatios?.find(
            (item) =>
              item.fuelCategory.fuelCategory ===
                params.node.data.fuelCategory && item.endUseType === null
          )?.energyEffectivenessRatio
        }
        const energyContent = (energyDensity * Number(params.newValue)).toFixed(
          0
        )
        // TODO Compliance units should be calculated on the backend and returned
        const complianceUnits = (
          ((Number(targetCi) * Number(eer) - Number(effectiveCarbonIntensity)) *
            energyContent) /
          1000000
        ).toFixed(0)
        const updatedData = {
          ...params.node.data,
          energy: energyContent,
          targetCi,
          eer,
          endUse: params.node.data.endUse || null,
          ciOfFuel: effectiveCarbonIntensity,
          complianceUnits: Number(complianceUnits),
          energyDensity
        }
        params.node.updateData(updatedData)
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
        const errArr = {
          [params.node.data.id]: error.response?.data?.detail?.map(
            (err) => err.loc[1]
          )
        }
        setErrors(errArr)

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const field = error.response?.data?.detail[0]?.loc[1]
            ? t(
                `fuelSupply:fuelSupplyColLabels.${error.response?.data?.detail[0]?.loc[1]}`
              )
            : ''
          const errMsg = `Error updating row: ${field} ${error.response?.data?.detail[0]?.msg}`

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
    if (action === 'duplicate') {
      const newRowID = uuid()
      const rowData = {
        ...params.node.data,
        id: newRowID,
        fuelSupplyId: null,
        fuelSupply: null,
        validationStatus: 'error',
        modified: true
      }

      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      setErrors({ [newRowID]: 'fuelSupply' })

      alertRef.current?.triggerAlert({
        message: 'Error updating row: Fuel supply Fields required',
        severity: 'error'
      })
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
        <BCAlert2 ref={alertRef} data-test="alert-box" />
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('fuelSupply:addFuelSupplyRowsTitle')}
          </Typography>
          <Typography
            variant="body4"
            color="primary"
            sx={{ marginY: '2rem' }}
            component="div"
          >
            {t('fuelSupply:fuelSupplySubtitle')}
          </Typography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
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
