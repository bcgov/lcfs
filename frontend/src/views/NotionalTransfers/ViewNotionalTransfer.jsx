import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import Loading from '@/components/Loading'
import { ROUTES } from '@/constants/routes'
import {
  useDeleteNotionalTransfer,
  useNotionalTransferOptions,
  useGetNotionalTransfer,
  useUpdateNotionalTransfer
} from '@/hooks/useNotionalTransfer'
import { faFloppyDisk, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { addEditSchema } from './components/_schema'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { useQueryClient } from '@tanstack/react-query'

export const ViewNotionalTransfer = () => {
  const gridRef = useRef(null)
  const alertRef = useRef()
  const { notionalTransferID } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'notionalTransfer'])
  const queryClient = useQueryClient()

  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [modalData, setModalData] = useState(null)

  const { data: optionsData, isLoading, isFetched } = useNotionalTransferOptions()

  const { data: notionalTransferData, isLoading: isNotionalTransferDataLoading } =
    useGetNotionalTransfer(notionalTransferID)

  const { mutate: updateNotionalTransfer, isPending: isUpdateNotionalTransferPending } =
    useUpdateNotionalTransfer(notionalTransferID, {
      onSuccess: () => {
        queryClient.invalidateQueries(['notional-transfer', notionalTransferID])
        navigate(ROUTES.ADMIN_NOTIONAL_TRANSFERS + `?hid=${notionalTransferID}`)
      }
    })
  const { mutate: deleteNotionalTransfer, isPending: isDeleteNotionalTransferPending } =
    useDeleteNotionalTransfer(notionalTransferID, {
      onSuccess: () => {
        navigate(ROUTES.ADMIN_NOTIONAL_TRANSFERS, {
          state: {
            message: t('notionalTransfer:notionalTransferDeleteSuccessMsg'),
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
    overlayNoRowsTemplate: t('notionalTransfer:noNotionalTransfersFound'),
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
        ...notionalTransferData,
        fuelCategory: notionalTransferData.fuelCategory.category
      }
    ])
    params.api.sizeColumnsToFit()
  }

  const validationHandler = async (row) => {
    try {
      await addEditSchema.notionalTransferSchema(t, optionsData).validate(row.data)
      setAlertMessage(`Validated notional transfer`)
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

  const handleOpenModal = async (status) => {
    if (status === 'APPROVED') {
      setModalData({
        primaryButtonAction: () =>
          handleNotionalTransferAction('APPROVED'),
        primaryButtonText: t('notionalTransfer:approveNotionalTransferBtn'),
        secondaryButtonText: t('cancelBtn'),
        title: t('notionalTransfer:approveNotionalTransfer'),
        content: (
          <Stack>
            <BCTypography variant="h6">
              {t('notionalTransfer:approveNotionalTransfer')}
            </BCTypography>
            <BCTypography mt={1} variant="body5">
              {t('notionalTransfer:approveConfirmText')}
            </BCTypography>
          </Stack>
        )
      })
    }
    if (status === 'DELETED') {
      setModalData({
        primaryButtonAction: () => deleteNotionalTransfer(),
        primaryButtonText: t('notionalTransfer:deleteNotionalTransferBtn'),
        secondaryButtonText: t('cancelBtn'),
        title: t('notionalTransfer:deleteNotionalTransfer'),
        content: (
          <Stack>
            <BCTypography variant="h6">
              {t('notionalTransfer:deleteNotionalTransfer')}
            </BCTypography>
            <BCTypography mt={1} variant="body5">
              {t('notionalTransfer:deleteConfirmText')}
            </BCTypography>
          </Stack>
        )
      })
    }
  }

  const handleNotionalTransferAction = async (status) => {
    gridApi.stopEditing(false)
    const row = gridApi.getDisplayedRowAtIndex(0)
    await validationHandler(row)
    const data = {
      ...row.data,
      lastUpdated: new Date().toISOString().split('T')[0],
      fuelCategoryId: optionsData.fuelCategories.find(
        (elm) => elm.category === row.data.fuelCategory
      ).fuelCategoryId,
      status
    }

    updateNotionalTransfer(data)
  }

  const title = {
    Approved: t('notionalTransfer:approvedNotionalTransferTitle'),
    Deleted: t('notionalTransfer:deletedNotionalTransferTitle'),
    Draft: t('notionalTransfer:editNotionalTransferTitle')
  }

  if (isLoading || isNotionalTransferDataLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <>
        <Grid2 className="add-edit-notional-transfer-container" mx={-1}>
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
              {title[notionalTransferData.status]}{' '}
              {notionalTransferData.legalName}
            </Typography>
          </div>
          <BCBox
            my={2}
            component="div"
            style={{ height: '100%', width: '100%' }}
          >
            <BCDataGridEditor
              gridKey={'add-notional-transfer'}
              className="ag-theme-quartz"
              getRowId={(params) => params.data.id}
              gridRef={gridRef}
              columnDefs={addEditSchema.notionalTransferColDefs(
                t,
                optionsData,
                notionalTransferData.status === 'DRAFT',
                gridApi
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
          {notionalTransferData.status === 'DRAFT' && (
            <Stack
              direction={{ md: 'column', lg: 'row' }}
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
                onClick={() => handleOpenModal('DELETED')}
                disabled={isUpdateNotionalTransferPending || isDeleteNotionalTransferPending}
              >
                <Typography variant="subtitle2">
                  {t('notionalTransfer:deleteNotionalTransferBtn')}
                </Typography>
              </BCButton>

              <BCButton
                variant="outlined"
                size="medium"
                color="primary"
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
                onClick={() => handleNotionalTransferAction('DRAFT')}
                disabled={isUpdateNotionalTransferPending || isDeleteNotionalTransferPending}
              >
                <Typography variant="subtitle2">
                  {t('notionalTransfer:saveDraftBtn')}
                </Typography>
              </BCButton>

              <BCButton
                variant="contained"
                size="medium"
                color="primary"
                onClick={() => handleOpenModal('APPROVED')}
                disabled={isUpdateNotionalTransferPending || isDeleteNotionalTransferPending}
              >
                <Typography variant="subtitle2">
                  {t('notionalTransfer:approveNotionalTransferBtn')}
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
