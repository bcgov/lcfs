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
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { v4 as uuid } from 'uuid'
import * as ROUTES from '@/constants/routes/routes.js'
import { DEFAULT_CI_FUEL } from '@/constants/common'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'

export const AddEditAllocationAgreements = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})

  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'allocationAgreement', 'reports'])
  const guides = useMemo(() =>
    t('allocationAgreement:allocationAgreementGuides', { returnObjects: true })
  )
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()

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
  }, [location.state?.message, location.state?.severity])

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
    const updatedColumnDefs = allocationAgreementColDefs(
      optionsData,
      currentUser,
      errors,
      warnings
    )
    setColumnDefs(updatedColumnDefs)
  }, [optionsData, currentUser, errors, warnings])

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

      // User cannot select their own organization as the transaction partner
      if (params.colDef.field === 'transactionPartner') {
        if (params.newValue === currentUser.organization.name) {
          alertRef.current?.triggerAlert({
            message:
              'You cannot select your own organization as the transaction partner.',
            severity: 'error'
          })
          params.node.setDataValue('transactionPartner', '')
          return
        }
      }

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

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'allocationAgreementId',
        labelPrefix: 'allocationAgreement:allocationAgreementColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      updatedData.ciOfFuel = params.node.data.ciOfFuel
      params.node.updateData(updatedData)
    },
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      await handleScheduleDelete(
        params,
        'allocationAgreementId',
        saveRow,
        alertRef,
        setRowData,
        { id: uuid() }
      )
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
            {t('allocationAgreement:allocationAgreementTitle')}
          </BCTypography>
          <BCBox my={2}>
            {guides.map((v, i) => (
              <BCTypography
                key={i}
                variant="body4"
                color="text"
                my={0.5}
                component="div"
              >
                {v}
              </BCTypography>
            ))}
          </BCBox>
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
