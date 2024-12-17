import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import {
  defaultColDef,
  allocationAgreementColDefs,
  PROVISION_APPROVED_FUEL_CODE
} from './_schema'
import {
  useAllocationAgreementOptions,
  useGetAllocationAgreements,
  useSaveAllocationAgreement
} from '@/hooks/useAllocationAgreement'
import { v4 as uuid } from 'uuid'
import * as ROUTES from '@/constants/routes/routes.js'
import { DEFAULT_CI_FUEL } from '@/constants/common'

export const AddEditAllocationAgreements = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [gridApi, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'allocationAgreement', 'reports'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useAllocationAgreementOptions({ compliancePeriod })
  const { mutateAsync: saveRow } = useSaveAllocationAgreement({
    complianceReportId
  })

  const { data, isLoading: allocationAgreementsLoading } =
    useGetAllocationAgreements(complianceReportId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'allocationAgreement:noAllocationAgreementsFound'
      ),
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

      if (
        Array.isArray(data.allocationAgreements) &&
        data.allocationAgreements.length > 0
      ) {
        const updatedRowData = data.allocationAgreements.map((item) => ({
          ...item,
          id: item.id || uuid() // Ensure every item has a unique ID
        }))
        setRowData([...updatedRowData, { id: uuid() }])
      } else {
        // If allocationAgreements is not available or empty, initialize with a single row
        setRowData([{ id: uuid() }])
      }

      params.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.setFocusedCell(lastRowIndex, 'allocationTransactionType')
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'allocationTransactionType'
        })
      }, 100)
    },
    [data]
  )

  useEffect(() => {
    const updatedColumnDefs = allocationAgreementColDefs(optionsData, errors)
    setColumnDefs(updatedColumnDefs)
  }, [errors, optionsData])

  useEffect(() => {
    if (
      !allocationAgreementsLoading &&
      data?.allocationAgreements?.length > 0
    ) {
      const updatedRowData = data.allocationAgreements.map((item) => ({
        ...item,
        agreementType: item.agreementType?.type,
        id: uuid()
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid() }])
    }
  }, [data, allocationAgreementsLoading])

  const onCellValueChanged = useCallback(
    async (params) => {
      if (params.colDef.field === 'provisionOfTheAct') {
        params.node.setDataValue('fuelCode', '')
      }
      if (
        ['fuelType', 'fuelCode', 'provisionOfTheAct'].includes(
          params.colDef.field
        )
      ) {
        let ciOfFuel = 0
        if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
          const fuelType = optionsData?.fuelTypes?.find(
            (obj) => params.data.fuelType === obj.fuelType
          )
          const fuelCode = fuelType?.fuelCodes?.find(
            (item) => item.fuelCode === params.data.fuelCode
          )
          ciOfFuel = fuelCode?.carbonIntensity || 0
        } else {
          const fuelType = optionsData?.fuelTypes?.find(
            (obj) => params.data.fuelType === obj.fuelType
          )
          ciOfFuel = fuelType?.defaultCarbonIntensity || 0
        }

        params.node.setDataValue('ciOfFuel', ciOfFuel)
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

      let updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      if (updatedData.fuelType === 'Other') {
        updatedData.ciOfFuel = DEFAULT_CI_FUEL[updatedData.fuelCategory]
      }

      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      if (isFuelCodeScenario && !updatedData.fuelCode) {
        // Fuel code is required but not provided
        setErrors((prevErrors) => ({
          ...prevErrors,
          [params.node.data.id]: ['fuelCode']
        }))

        alertRef.current?.triggerAlert({
          message: t('allocationAgreement:fuelCodeFieldRequiredError'),
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
            t(`allocationAgreement:allocationAgreementColLabels.${field}`)
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
      updatedData.ciOfFuel = params.node.data.ciOfFuel
      params.node.updateData(updatedData)
    },
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      const updatedRow = { ...params.node.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.allocationAgreementId) {
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
    !allocationAgreementsLoading && (
      <Grid2 className="add-edit-allocation-agreement-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('allocationAgreement:addAllocationAgreementRowsTitle')}
          </BCTypography>
          <BCTypography
            variant="body4"
            color="primary"
            sx={{ marginY: '2rem' }}
            component="div"
          >
            {t('allocationAgreement:allocationAgreementSubtitle')}
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
            loading={optionsLoading || allocationAgreementsLoading}
            loadingMessage={'Loading...'}
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
