import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, allocationAgreementColDefs } from './_schema'
import {
  useAllocationAgreementOptions,
  useGetAllocationAgreements,
  useSaveAllocationAgreement
} from '@/hooks/useAllocationAgreement'
import { v4 as uuid } from 'uuid'

export const AddEditAllocationAgreements = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [gridApi, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'allocationAgreement'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useAllocationAgreementOptions({ compliancePeriod })
  const { mutateAsync: saveRow } = useSaveAllocationAgreement({ complianceReportId })

  const { data, isLoading: allocationAgreementsLoading } =
    useGetAllocationAgreements(complianceReportId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('allocationAgreement:noAllocationAgreementsFound'),
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
      setRowData([...(data || { id: uuid() })])
      params.api.sizeColumnsToFit()
    },
    [data]
  )

  useEffect(() => {
    console.log("OPTIONS DATA", optionsData)
    if (optionsData?.fuelCategories?.length > 0) {
      console.log("LOADING OPTIONS DATA")
      const updatedColumnDefs = allocationAgreementColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData])

  useEffect(() => {
    if (!allocationAgreementsLoading && data?.allocationAgreements?.length > 0) {
      const updatedRowData = data.allocationAgreements.map((item) => ({
        ...item,
        agreementType: item.agreementType?.type,
        tradingPartner: item.tradingPartner?.name,
        id: uuid()
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid() }])
    }
  }, [data, allocationAgreementsLoading])

  const onCellValueChanged = useCallback(
    async (params) => {
      // Need to add any specific logic for cell value changes here
      // For example, updating related fields based on the changed value
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
                `allocationAgreement:allocationAgreementColLabels.${error.response?.data?.detail[0]?.loc[1]}`
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
    if (action === 'duplicate') {
      const newRowID = uuid()
      const rowData = {
        ...params.node.data,
        id: newRowID,
        allocationAgreementId: null,
        allocationAgreement: null,
        validationStatus: 'error',
        modified: true
      }

      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      setErrors({ [newRowID]: 'allocationAgreement' })

      alertRef.current?.triggerAlert({
        message: 'Error updating row: Allocation Agreement Fields required',
        severity: 'error'
      })
    }
  }

  return (
    isFetched &&
    !allocationAgreementsLoading && (
      <Grid2 className="add-edit-allocation-agreement-container" mx={-1}>
        <BCAlert2 ref={alertRef} data-test="alert-box" />
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('allocationAgreement:addAllocationAgreementRowsTitle')}
          </Typography>
          <Typography
            variant="body4"
            color="primary"
            sx={{ marginY: '2rem' }}
            component="div"
          >
            {t('allocationAgreement:allocationAgreementSubtitle')}
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
            loading={optionsLoading || allocationAgreementsLoading}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            stopEditingWhenCellsLoseFocus
          />
        </BCBox>
      </Grid2>
    )
  )
}