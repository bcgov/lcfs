import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { v4 as uuid } from 'uuid'
import BCButton from '@/components/BCButton'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { useFuelCodeOptions, useSaveFuelCode } from '@/hooks/useFuelCode'
import withRole from '@/utils/withRole'
import { defaultColDef, fuelCodeColDefs } from './_schema'
import { useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'

const AddFuelCodeBase = () => {
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [focusedCell, setFocusedCell] = useState(null)
  const [cloneFuelCodeId, setCloneFuelCodeId] = useState(null)
  const [prefix, setPrefix] = useState('BCLCF')
  const [paramsData, setParamsData] = useState({})
  const [gridApi, setGridApi] = useState(null)

  const gridRef = useRef(null)
  const alertRef = useRef()
  const { t } = useTranslation(['common', 'fuelCode'])
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()
  const apiService = useApiService()
  const { data: clonedFuelCodeData, isLoading: isClonedFuelCodeLoading, refetch } = useQuery({
    queryKey: ['fuelCode', cloneFuelCodeId, prefix],
    queryFn: async ({ queryKey }) => {
      // eslint-disable-next-line no-unused-vars
      const [_, cloneFuelCodeId, prefix] = queryKey
      let path = apiRoutes.fuelCodeSearch
      path +=
        'prefix=' +
        (prefix || 'BCLCF') +
        '&distinctSearch=false&fuelCode=' +
        cloneFuelCodeId
      const response = await apiService.get(path)
      return response.data.fuelCodes[0]
    },
    enabled: !!cloneFuelCodeId
  })
  const { mutateAsync: saveRow } = useSaveFuelCode()

  useEffect(() => {
    if (optionsData) {
      const updatedColumnDefs = fuelCodeColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData])

  const onGridReady = useCallback(
    (params) => {
      setGridApi(params.api)
      setRowData([
        {
          id: uuid(),
          prefix: 'BCLCF',
          fuelSuffix: optionsData?.fuelCodePrefixes?.find(
            (item) => item.prefix === 'BCLCF'
          ).nextFuelCode
        }
      ])
      params.api.sizeColumnsToFit()
    },
    [optionsData]
  )

  const onCellValueChanged = useCallback(
    async (params) => {
      const updatedData = { ...params.data, modified: true }

      if (params.colDef.field === 'prefix') {
        updatedData.fuelSuffix = optionsData?.fuelCodePrefixes?.find(
          (item) => item.prefix === params.newValue
        ).nextFuelCode
      }
      if (params.column.colId === 'fuelSuffix') {
        setCloneFuelCodeId(params.newValue)
        setPrefix(params.data.prefix)
        setFocusedCell(params.column.colId)
        setParamsData(params.data)
        refetch()
      }

      params.api.applyTransaction({ update: [updatedData] })
    },
    [optionsData?.fuelCodePrefixes, refetch]
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
        console.error('Error updating row:', error)

        setErrors({
          [params.node.data.id]: error.response.data.errors[0].fields
        })

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (
          error.response?.data?.errors &&
          error.response.data.errors.length > 0
        ) {
          const { fields, message } = error.response.data.errors[0]
          const fieldLabels = fields.map((field) =>
            t(`fuelCode:fuelCodeColLabels.${field}`)
          )
          const errMsg = `Error updating row: ${fieldLabels.length === 1 ? fieldLabels[0] : ''
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
    [saveRow, t]
  )

  const onAction = useCallback(
    async (action, params) => {
      if (action === 'duplicate') {
        const rowData = {
          ...params.data,
          id: uuid(),
          fuelCodeId: null,
          modified: true,
          isValid: false,
          validationStatus: 'error',
          validationMsg: 'Fill in the missing fields'
        }
        if (params.api) {
          if (params.data.fuelCodeId) {
            try {
              const response = await saveRow(rowData)
              const updatedData = {
                ...response.data,
                id: uuid(),
                modified: false,
                isValid: false,
                validationStatus: 'error'
              }
              params.api.applyTransaction({
                add: [updatedData],
                addIndex: params.node?.rowIndex + 1
              })
              params.api.refreshCells()
              alertRef.current?.triggerAlert({
                message: 'Row duplicated successfully.',
                severity: 'success'
              })
            } catch (error) {
              console.error('Error duplicating row:', error)
              alertRef.current?.triggerAlert({
                message: `Error duplicating row: ${error.message}`,
                severity: 'error'
              })
            }
          } else {
            params.api.applyTransaction({
              add: [rowData],
              addIndex: params.node?.rowIndex + 1
            })
          }
        }
      } else if (action === 'delete') {
        const updatedRow = { ...params.data, deleted: true }
        if (params.api) {
          if (updatedRow.fuelCodeId) {
            try {
              await saveRow(updatedRow)
              params.api.applyTransaction({ remove: [params.node.data] })
              alertRef.current?.triggerAlert({
                message: 'Row deleted successfully.',
                severity: 'success'
              })
            } catch (error) {
              console.error('Error deleting row:', error)
              alertRef.current?.triggerAlert({
                message: `Error deleting row: ${error.message}`,
                severity: 'error'
              })
            }
          } else {
            params.api.applyTransaction({ remove: [params.node.data] })
          }
        }
      }
    },
    [saveRow]
  )
  useEffect(() => {
    if (
      focusedCell === 'fuelSuffix' &&
      !isClonedFuelCodeLoading &&
      clonedFuelCodeData
    ) {
      const updatedData = {
        ...paramsData,
        fuelSuffix: clonedFuelCodeData.fuelSuffix,
        prefix: clonedFuelCodeData.fuelCodePrefix?.prefix || prefix,
        company: clonedFuelCodeData.company,
        fuel: clonedFuelCodeData.fuelCodeType?.fuelType,
        feedstock: clonedFuelCodeData.feedstock,
        feedstockLocation: clonedFuelCodeData.feedstockLocation,
        feedstockMisc: clonedFuelCodeData.feedstockMisc,
        feedstockTransportMode:
          clonedFuelCodeData.feedstockFuelTransportModes?.map(
            (mode) => mode.feedstockFuelTransportMode.transportMode
          ),
        finishedFuelTransportMode:
          clonedFuelCodeData.finishedFuelTransportModes?.map(
            (mode) => mode.finishedFuelTransportMode.transportMode
          ),
        formerCompany: clonedFuelCodeData.formerCompany,
        contactName: clonedFuelCodeData.contactName,
        contactEmail: clonedFuelCodeData.contactEmail
      }
      gridApi.applyTransaction({ update: [updatedData] })
      setFocusedCell(undefined)
    }
  }, [isClonedFuelCodeLoading, clonedFuelCodeData, focusedCell, paramsData, prefix, gridApi])

  if (isLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-fuel-code-container" mx={-1}>
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('fuelCode:newFuelCodeTitle')}
          </Typography>
        </div>
        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStopped={onCellEditingStopped}
          onAction={onAction}
          showAddRowsButton={true}
          context={{ errors }}
        />
        <Stack
          direction={{ md: 'column', lg: 'row' }}
          spacing={{ xs: 2, sm: 2, md: 3 }}
          useFlexGap
          flexWrap="wrap"
        >
          <BCButton
            variant="contained"
            size="medium"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
            }
            onClick={() => {
              console.log('save click')
            }}
          >
            <Typography variant="subtitle2">
              {t('fuelCode:saveDraftBtn')}
            </Typography>
          </BCButton>
        </Stack>
      </Grid2>
    )
  )
}

export const AddFuelCode = withRole(
  AddFuelCodeBase,
  [roles.analyst],
  ROUTES.DASHBOARD
)
