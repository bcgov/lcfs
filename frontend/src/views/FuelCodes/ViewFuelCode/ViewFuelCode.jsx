import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import Loading from '@/components/Loading'
import { ROUTES } from '@/constants/routes'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'
import {
  useDeleteFuelCode,
  useFuelCodeOptions,
  useGetFuelCode,
  useUpdateFuelCode
} from '@/hooks/useFuelCode'
import { faFloppyDisk, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { addEditSchema } from '../_schema'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { useQueryClient } from '@tanstack/react-query'

const ViewFuelCode = () => {
  const gridRef = useRef(null)
  const alertRef = useRef()
  const { fuelCodeID } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'fuelCode'])
  const queryClient = useQueryClient()

  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [modalData, setModalData] = useState(null)

  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()

  const { data: fuelCodeData, isLoading: isFuelCodeDataLoading } =
    useGetFuelCode(fuelCodeID)

  const { mutate: updateFuelCode, isPending: isUpdateFuelCodePending } =
    useUpdateFuelCode(fuelCodeID, {
      onSuccess: () => {
        queryClient.invalidateQueries(['fuel-code', fuelCodeID])
        navigate(ROUTES.ADMIN_FUEL_CODES + `?hid=${fuelCodeID}`)
      }
    })
  const { mutate: deleteFuelCode, isPending: isDeleteFuelCodePending } =
    useDeleteFuelCode(fuelCodeID, {
      onSuccess: () => {
        navigate(ROUTES.ADMIN_FUEL_CODES, {
          state: {
            message: t('fuelCode:fuelCodeDeleteSuccessMsg'),
            severity: 'success'
          }
        })
      }
    })

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = () => ({
    overlayNoRowsTemplate: t('fuelCode:noFuelCodesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  })

  const onGridReady = (params) => {
    setGridApi(params.api)
    setColumnApi(params.columnApi)
    setRowData([
      {
        ...fuelCodeData,
        prefix: fuelCodeData.fuelCodePrefix.prefix,
        fuel: fuelCodeData.fuelCodeType.fuelType,
        feedstockTransportMode: fuelCodeData.feedstockFuelTransportModes.map(
          (mode) => mode.feedstockFuelTransportMode?.transportMode
        ),
        finishedFuelTransportMode: fuelCodeData.finishedFuelTransportModes.map(
          (mode) => mode.finishedFuelTransportMode?.transportMode
        )
      }
    ])
    params.api.sizeColumnsToFit()
  }

  const validationHandler = async (row) => {
    try {
      await addEditSchema.fuelCodeSchema(t, optionsData).validate(row.data)
      setAlertMessage(`Validated fuel code`)
      setAlertSeverity('success')
      row.setData({
        ...row.data,
        isValid: true,
        validationMsg: ''
      })
      alertRef.current?.triggerAlert()
    } catch (err) {
      setAlertMessage(err.errors[0])
      setAlertSeverity('error')
      row.setData({
        ...row.data,
        isValid: false,
        validationMsg: err.errors[0]
      })
      alertRef.current?.triggerAlert()
      throw new Error()
    }
  }

  const getTransportModeIds = (transportMode) => {
    const transportModeIds = []
    if (transportMode) {
      transportMode.forEach((transportMode) => {
        transportModeIds.push({
          fuelCodeId: null,
          transportModeId: optionsData.transportModes.find(
            (elm) => elm.transportMode === transportMode
          ).transportModeId
        })
      })
    }
    return transportModeIds
  }

  const handleOpenModal = async (status) => {
    if (status === FUEL_CODE_STATUSES.APPROVED) {
      setModalData({
        primaryButtonAction: () =>
          handleFuelCodeAction(FUEL_CODE_STATUSES.APPROVED),
        primaryButtonText: t('fuelCode:approveFuelCodeBtn'),
        secondaryButtonText: t('cancelBtn'),
        title: t('fuelCode:approveFuelCode'),
        content: (
          <Stack>
            <BCTypography variant="h6">
              {t('fuelCode:approveFuelCode')}
            </BCTypography>
            <BCTypography mt={1} variant="body5">
              {t('fuelCode:approveConfirmText')}
            </BCTypography>
          </Stack>
        )
      })
    }
    if (status === FUEL_CODE_STATUSES.DELETED) {
      setModalData({
        primaryButtonAction: () => deleteFuelCode(),
        primaryButtonText: t('fuelCode:deleteFuelCodeBtn'),
        secondaryButtonText: t('cancelBtn'),
        title: t('fuelCode:deleteFuelCode'),
        content: (
          <Stack>
            <BCTypography variant="h6">
              {t('fuelCode:deleteFuelCode')}
            </BCTypography>
            <BCTypography mt={1} variant="body5">
              {t('fuelCode:deleteConfirmText')}
            </BCTypography>
          </Stack>
        )
      })
    }
  }

  const handleFuelCodeAction = async (status) => {
    gridApi.stopEditing(false)
    const row = gridApi.getDisplayedRowAtIndex(0)
    await validationHandler(row)
    const data = {
      ...row.data,
      lastUpdated: new Date().toISOString().split('T')[0],
      prefixId: optionsData.fuelCodePrefixes.find(
        (elm) => elm.prefix === row.data.prefix
      ).fuelCodePrefixId,
      fuelTypeId: optionsData.fuelTypes.find(
        (elm) => elm.fuelType === row.data.fuel
      ).fuelTypeId,
      feedstockFuelTransportModes: [
        ...getTransportModeIds(row.data.feedstockTransportMode)
      ],
      finishedFuelTransportModes: [
        ...getTransportModeIds(row.data.finishedFuelTransportMode)
      ],
      status
    }

    updateFuelCode(data)
  }

  const title = {
    Approved: t('fuelCode:approvedFuelCodeTitle'),
    Deleted: t('fuelCode:deletedFuelCodeTitle'),
    Draft: t('fuelCode:editFuelCodeTitle')
  }

  if (isLoading || isFuelCodeDataLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <>
        <Grid2 className="add-edit-fuel-code-container" mx={-1}>
          <div>
            {alertMessage && (
              <BCAlert
                ref={alertRef}
                data-test="alert-box"
                severity={alertSeverity}
                delay={5000}
              >
                {alertMessage}
              </BCAlert>
            )}
          </div>
          <div className="header">
            <Typography variant="h5" color="primary">
              {title[fuelCodeData.fuelCodeStatus.status]}{' '}
              {fuelCodeData.fuelCodePrefix.prefix} {fuelCodeData.fuelCode}
            </Typography>
          </div>
          <BCBox
            my={2}
            component="div"
            style={{ height: '100%', width: '100%' }}
          >
            <BCDataGridEditor
              gridKey={'add-fuel-code'}
              className="ag-theme-quartz"
              getRowId={(params) => params.data.id}
              gridRef={gridRef}
              columnDefs={addEditSchema.fuelCodeColDefs(
                t,
                optionsData,
                fuelCodeData.fuelCodeStatus.status === FUEL_CODE_STATUSES.DRAFT
              )}
              defaultColDef={addEditSchema.defaultColDef}
              onGridReady={onGridReady}
              rowData={rowData}
              setRowData={setRowData}
              gridApi={gridApi}
              columnApi={columnApi}
              gridOptions={gridOptions}
              getRowNodeId={(data) => data.id}
              defaultStatusBar={false}
            />
          </BCBox>
          {fuelCodeData.fuelCodeStatus.status === FUEL_CODE_STATUSES.DRAFT && (
            <Stack
              direction={{ md: 'coloumn', lg: 'row' }}
              spacing={{ xs: 2, sm: 2, md: 3 }}
              useFlexGap
              flexWrap="wrap"
              m={2}
            >
              <BCButton
                variant="outlined"
                size="medium"
                color="error"
                startIcon={
                  <FontAwesomeIcon icon={faTrash} className="small-icon" />
                }
                onClick={() => handleOpenModal(FUEL_CODE_STATUSES.DELETED)}
                disabled={isUpdateFuelCodePending || isDeleteFuelCodePending}
              >
                <Typography variant="subtitle2">
                  {t('fuelCode:deleteFuelCodeBtn')}
                </Typography>
              </BCButton>

              <BCButton
                variant="outlined"
                size="medium"
                color="primary"
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
                onClick={() => handleFuelCodeAction(FUEL_CODE_STATUSES.DRAFT)}
                disabled={isUpdateFuelCodePending || isDeleteFuelCodePending}
              >
                <Typography variant="subtitle2">
                  {t('fuelCode:saveDraftBtn')}
                </Typography>
              </BCButton>

              <BCButton
                variant="contained"
                size="medium"
                color="primary"
                onClick={() => handleOpenModal(FUEL_CODE_STATUSES.APPROVED)}
                disabled={isUpdateFuelCodePending || isDeleteFuelCodePending}
              >
                <Typography variant="subtitle2">
                  {t('fuelCode:approveFuelCodeBtn')}
                </Typography>
              </BCButton>
            </Stack>
          )}
        </Grid2>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
      </>
    )
  )
}

const AllowedRoles = [roles.analyst, roles.compliance_manager, roles.director]
export const ViewFuelCodeWithRole = withRole(ViewFuelCode, AllowedRoles)
ViewFuelCode.displayName = 'ViewFuelCode'
