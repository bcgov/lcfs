import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import Loading from '@/components/Loading'
import {
  useGetAllOtherUses,
  useOtherUsesOptions,
  useSaveOtherUses
} from '@/hooks/useOtherUses'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, otherUsesColDefs } from './_schema'
import { AddRowsButton } from './components/AddRowsButton'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { cleanEmptyStringValues } from '@/utils/formatters'

export const AddEditOtherUses = () => {
  const [rowData, setRowData] = useState([])
  // const [gridApi, setGridApi] = useState(null)
  // const [columnApi, setColumnApi] = useState(null)
  const [errors, setErrors] = useState({})

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'otherUses'])
  const { complianceReportId } = useParams()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useOtherUsesOptions()
  const { data: otherUses, isLoading: usesLoading } =
    useGetAllOtherUses(complianceReportId)
  const { mutateAsync: saveRow } = useSaveOtherUses()

  // const gridKey = 'add-other-uses'
  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('otherUses:noOtherUsesFound'),
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
      alertRef.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  const onGridReady = (params) => {
    // setGridApi(params.api)
    // setColumnApi(params.columnApi)

    const ensureRowIds = (rows) => {
      return rows.map((row) => {
        if (!row.id) {
          return {
            ...row,
            id: uuid(),
            isValid: true
          }
        }
        return row
      })
    }

    if (otherUses && otherUses.length > 0) {
      try {
        setRowData(ensureRowIds(otherUses))
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
  }

  // const onValidated = (status, message, params, response) => {
  //   let errMsg = message
  //   if (status === 'error') {
  //     const field = t(
  //       `otherUses:otherUsesColLabels.${message.response?.data?.detail[0]?.loc[1]}`
  //     )
  //     errMsg = `Error updating row: ${field}  ${message.response?.data?.detail[0]?.msg}`
  //     params.data.isValid = false
  //     params.data.validationMsg =
  //       field + ' ' + message.response?.data?.detail[0]?.msg
  //   }

  //   alertRef.current?.triggerAlert({
  //     message: errMsg,
  //     severity: status
  //   })
  // }

  const onAction = async (action, params) => {
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
    if (action === 'duplicate') {
      const newRowID = uuid()
      console.log(1, params.data)
      const rowData = {
        ...params.data,
        id: newRowID,
        otherUsesId: null,
        // validationStatus: 'error',
        modified: true
      }
      console.log(2, rowData)
      console.log(params.node?.rowIndex)
      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      // setErrors({ [newRowID]: 'fuelCode' })

      // alertRef.current?.triggerAlert({
      //   message: 'Error updating row: Fuel code Field required',
      //   severity: 'error'
      // })

      let updatedData = cleanEmptyStringValues(rowData)

      try {
        setErrors({})
        const { data: dupeData } = await saveRow(updatedData)
        console.log(dupeData)
        updatedData = {
          ...updatedData,
          otherUsesId: dupeData.otherUsesId,
          validationStatus: 'success',
          modified: false
        }
        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })
        console.log(6, updatedData)
      } catch (error) {
        console.log('error')
        const errArr = {
          [params.data.id]: error.response.data.detail.map((err) => err.loc[1])
        }
        setErrors(errArr)

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const field = error.response?.data?.detail[0]?.loc[1]
            ? t(
                `fuelCode:fuelCodeColLabels.${error.response?.data?.detail[0]?.loc[1]}`
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
      console.log(5, updatedData)
      params.node.updateData(updatedData)
      params.api.refreshCells()
    }
  }

  const onCellEditingStopped = useCallback(
    async (params) => {
      console.log(3, params.data)
      if (params.oldValue === params.newValue) return
      params.node.updateData({ ...params.data, validationStatus: 'pending' })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = cleanEmptyStringValues(params.data)

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
          [params.data.id]: error.response.data.detail.map((err) => err.loc[1])
        }
        setErrors(errArr)

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const field = error.response?.data?.detail[0]?.loc[1]
            ? t(
                `fuelCode:fuelCodeColLabels.${error.response?.data?.detail[0]?.loc[1]}`
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
      console.log(4, updatedData)
      params.node.updateData(updatedData)
    },
    [saveRow, t]
  )

  // const statusBarComponent = useMemo(
  //   () => (
  //     <Box component="div" m={2}>
  //       <AddRowsButton
  //         gridApi={gridApi}
  //         complianceReportId={complianceReportId}
  //       />
  //     </Box>
  //   ),
  //   [gridApi, complianceReportId]
  // )

  if (optionsLoading || usesLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-other-uses-container" mx={-1}>
        <BCAlert2 ref={alertRef} data-test="alert-box" />
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('otherUses:newOtherUsesTitle')}
          </Typography>
        </div>
        {/* <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCDataGridEditor
            gridKey={gridKey}
            className="ag-theme-quartz"
            getRowId={(params) => params.data.id}
            gridRef={gridRef}
            columnDefs={otherUsesColDefs(t, optionsData, gridApi, onValidated)}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            setRowData={setRowData}
            gridApi={gridApi}
            columnApi={columnApi}
            gridOptions={gridOptions}
            getRowNodeId={(data) => data.id}
            defaultStatusBar={false}
            statusBarComponent={statusBarComponent}
            saveRow={saveRow}
            onValidated={onValidated}
            stopEditingWhenCellsLoseFocus={true}
          />
        </BCBox> */}

        <BCGridEditor
          gridRef={gridRef}
          getRowId={(params) => params.data.id}
          columnDefs={otherUsesColDefs(optionsData, errors)}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          gridOptions={gridOptions}
          loading={optionsLoading || usesLoading}
          onAction={onAction}
          onCellEditingStopped={onCellEditingStopped}
        />

        <Box component="div" m={2}>
          <AddRowsButton
            gridApi={gridRef.current?.api}
            complianceReportId={complianceReportId}
          />
        </Box>

        <Stack
          direction={{ md: 'column', lg: 'row' }}
          spacing={{ xs: 2, sm: 2, md: 3 }}
          useFlexGap
          flexWrap="wrap"
          m={2}
        >
          <BCButton
            variant="contained"
            size="medium"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
            }
            onClick={() => gridRef.current?.api.stopEditing(false)}
          >
            <Typography variant="subtitle2">
              {t('otherUses:saveOtherUsesBtn')}
            </Typography>
          </BCButton>
        </Stack>
      </Grid2>
    )
  )
}
