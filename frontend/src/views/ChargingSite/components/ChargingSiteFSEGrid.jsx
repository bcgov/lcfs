import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid, Stack } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSquareCheck } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { fseColDefs } from './_schema'
import {
  useDeleteNotificationMessages,
  useGetNotificationMessages,
  useMarkNotificationAsRead
} from '@/hooks/useNotifications'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { defaultInitialPagination } from '@/constants/schedules.js'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: [],
  filters: []
}

export const ChargingSiteFSEGrid = () => {
  const gridRef = useRef(null)
  const alertRef = useRef(null)
  const [gridApi, setGridApi] = useState(null)
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [selectedRowCount, setSelectedRowCount] = useState(0)

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { t } = useTranslation(['chargingSite'])
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const { refetch } = useGetNotificationMessages()
  const markAsReadMutation = useMarkNotificationAsRead()
  const deleteMutation = useDeleteNotificationMessages()

  const queryData = useGetNotificationMessages(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  // row class rules for unread messages
  const rowClassRules = useMemo(
    () => ({
      'unread-row': (params) => !params.data.isRead
    }),
    []
  )
  const selectionColumnDef = useMemo(() => {
    return {
      sortable: false,
      resizable: false,
      suppressHeaderMenuButton: true,
      headerTooltip: 'Checkboxes indicate selection'
    }
  }, [])
  const rowSelection = useMemo(() => {
    return {
      mode: 'multiRow'
    }
  }, [])

  // Consolidated mutation handler
  const handleMutation = useCallback(
    (mutation, selectedNotifications, successMessage, errorMessage) => {
      if (selectedNotifications.length === 0) {
        alertRef.current?.triggerAlert({
          message: t('notifications:noNotificationsSelectedText'),
          severity: 'warning'
        })
        return
      }
      mutation.mutate(selectedNotifications, {
        onSuccess: () => {
          // eslint-disable-next-line chai-friendly/no-unused-expressions
          successMessage &&
            alertRef.current?.triggerAlert({
              message: t(successMessage),
              severity: 'success'
            })
          refetch()
        },
        onError: (error) => {
          alertRef.current?.triggerAlert({
            message: t(errorMessage, { error: error.message }),
            severity: 'error'
          })
        }
      })
    },
    [t, refetch]
  )

  const onGridReady = useCallback((params) => {
    setGridApi(params.api)
  }, [])

  // Toggle selection for visible rows
  const toggleSelectVisibleRows = useCallback(() => {
    if (!gridApi) return
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      node.setSelected(!isAllSelected)
    })
    setIsAllSelected(!isAllSelected)
  }, [gridApi, isAllSelected])

  // event handlers for delete, markAsRead, and row-level deletes
  const handleMarkAsRead = useCallback(() => {
    if (!gridApi) return
    const payload = isAllSelected
      ? { applyToAll: true }
      : {
          notification_ids: gridApi
            .getSelectedNodes()
            .map((n) => n.data.notificationMessageId)
        }
    handleMutation(
      markAsReadMutation,
      payload,
      'notifications:markAsReadSuccessText',
      'notifications:markAsReadErrorText'
    )
  }, [gridApi, isAllSelected, handleMutation, markAsReadMutation])

  const handleDelete = useCallback(() => {
    if (!gridApi) return
    const payload = isAllSelected
      ? { applyToAll: true }
      : {
          notification_ids: gridApi
            .getSelectedNodes()
            .map((n) => n.data.notificationMessageId)
        }
    handleMutation(
      deleteMutation,
      payload,
      'notifications:deleteSuccessText',
      'notifications:deleteErrorText'
    )
  }, [gridApi, isAllSelected, handleMutation, deleteMutation])

  const onCellClicked = useCallback(
    (params) => {
      if (
        params.column.colId === 'action' &&
        params.event.target.dataset.action
      ) {
        handleMutation(
          deleteMutation,
          { notification_ids: [params.data.notificationMessageId] },
          'notifications:deleteSuccessText',
          'notifications:deleteErrorText'
        )
      }
    },
    [handleMutation, deleteMutation]
  )

  const onSelectionChanged = useCallback((params) => {
    const { api } = params
    const visibleRows = []
    api.forEachNodeAfterFilterAndSort((node) => {
      visibleRows.push(node)
    })
    const selectedRows = visibleRows.filter((node) => node.isSelected())
    setSelectedRowCount(selectedRows.length)
    setIsAllSelected(
      visibleRows.length > 0 && visibleRows.length === selectedRows.length
    )
  }, [])

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    if (gridRef && gridRef.current) {
      gridRef.current.clearFilters()
    }
  }
  return (
    <BCBox mt={2}>
      <BCTypography variant="h6" color="primary">
        {t('gridTitle')}
      </BCTypography>
      <BCTypography variant="body4" color="text" mt={1} component="div">
        {t('gridDescription')}
      </BCTypography>

      {/* Buttons */}
      <Stack direction="row" spacing={1} component="div" my={2}>
        <BCButton
          data-test="select-all"
          variant={isAllSelected ? 'outlined' : 'contained'}
          color="primary"
          startIcon={
            <FontAwesomeIcon
              icon={faSquareCheck}
              className="small-icon fa-regular"
            />
          }
          onClick={toggleSelectVisibleRows}
        >
          {isAllSelected
            ? t('notifications:buttonStack.unselectAll')
            : t('notifications:buttonStack.selectAll')}
        </BCButton>
        <BCButton
          data-test="mark-as-read"
          variant="contained"
          color="primary"
          onClick={handleMarkAsRead}
          disabled={selectedRowCount === 0}
        >
          {t('notifications:buttonStack.markAsRead')}
        </BCButton>
        <BCButton
          data-test="mark-as-unread"
          variant="outlined"
          color="error"
          onClick={handleDelete}
          disabled={selectedRowCount === 0}
        >
          {t('notifications:buttonStack.deleteSelected')}
        </BCButton>
        <ClearFiltersButton onClick={handleClearFilters} />
      </Stack>
      <BCGridViewer
        gridKey="notifications-grid"
        onGridReady={onGridReady}
        gridRef={gridRef}
        alertRef={alertRef}
        columnDefs={fseColDefs(t, currentUser)}
        defaultColDefs={{ minWidth: 50, maxWidth: 600 }}
        queryData={queryData}
        dataKey="notifications"
        overlayNoRowsTemplate={t('notifications:noNotificationsFound')}
        autoSizeStrategy={{
          type: 'fitCellContents',
          defaultMinWidth: 100,
          defaultMaxWidth: 600
        }}
        rowSelection={rowSelection}
        rowClassRules={rowClassRules}
        onCellClicked={onCellClicked}
        selectionColumnDef={selectionColumnDef}
        onSelectionChanged={onSelectionChanged}
        // onRowClicked={handleRowClicked}
        paginationOptions={paginationOptions}
        onPaginationChange={(newPagination) =>
          setPaginationOptions((prev) => ({
            ...prev,
            ...newPagination
          }))
        }
      />
    </BCBox>
  )
}
