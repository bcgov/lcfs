import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Stack, Grid } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSquareCheck } from '@fortawesome/free-solid-svg-icons'

import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { columnDefs, routesMapping } from './_schema'
import {
  useGetNotificationMessages,
  useMarkNotificationAsRead,
  useDeleteNotificationMessages
} from '@/hooks/useNotifications'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Notifications = () => {
  const gridRef = useRef(null)
  const alertRef = useRef(null)
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [selectedRowCount, setSelectedRowCount] = useState(0)

  const { t } = useTranslation(['notifications'])
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  // react query hooks
  const { refetch } = useGetNotificationMessages()
  const markAsReadMutation = useMarkNotificationAsRead()
  const deleteMutation = useDeleteNotificationMessages()

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

  // Toggle selection for visible rows
  const toggleSelectVisibleRows = useCallback(() => {
    const gridApi = gridRef.current?.api
    if (gridApi) {
      gridApi.forEachNodeAfterFilterAndSort((node) => {
        node.setSelected(!isAllSelected)
      })
      setIsAllSelected(!isAllSelected)
    }
  }, [isAllSelected])

  // event handlers for delete, markAsRead, and row-level deletes
  const handleMarkAsRead = useCallback(() => {
    const gridApi = gridRef.current?.api
    if (gridApi) {
      const selectedNotifications = gridApi
        .getSelectedNodes()
        .map((node) => node.data.notificationMessageId)
      handleMutation(
        markAsReadMutation,
        selectedNotifications,
        'notifications:markAsReadSuccessText',
        'notifications:markAsReadErrorText'
      )
    }
  }, [handleMutation, markAsReadMutation])

  const handleDelete = useCallback(() => {
    const gridApi = gridRef.current?.api
    if (gridApi) {
      const selectedNotifications = gridApi
        .getSelectedNodes()
        .map((node) => node.data.notificationMessageId)
      handleMutation(
        deleteMutation,
        selectedNotifications,
        'notifications:deleteSuccessText',
        'notifications:deleteErrorText'
      )
    }
  }, [handleMutation, deleteMutation])

  const handleRowClicked = useCallback(
    (params) => {
      const { id, service, compliancePeriod } = JSON.parse(params.data.message)
      // Select the appropriate route based on the notification type
      const routeTemplate = routesMapping(currentUser)[service]

      if (routeTemplate && params.event.target.dataset.action !== 'delete') {
        navigate(
          // replace any matching query params by chaining these replace methods
          routeTemplate
            .replace(':transactionId', id)
            .replace(':transferId', id)
            .replace(':compliancePeriod', compliancePeriod)
            .replace(':complianceReportId', id)
        )
        handleMutation(markAsReadMutation, [params.data.notificationMessageId])
      }
    },
    [currentUser, navigate]
  )

  const onCellClicked = useCallback(
    (params) => {
      if (
        params.column.colId === 'action' &&
        params.event.target.dataset.action
      ) {
        handleMutation(
          deleteMutation,
          [params.data.notificationMessageId],
          'notifications:deleteSuccessText',
          'notifications:deleteErrorText'
        )
      }
    },
    [handleMutation, deleteMutation]
  )

  const onSelectionChanged = useCallback(() => {
    const gridApi = gridRef.current?.api
    const visibleRows = []
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      visibleRows.push(node)
    })
    const selectedRows = visibleRows.filter((node) => node.isSelected())
    setSelectedRowCount(selectedRows.length)
    setIsAllSelected(
      visibleRows.length > 0 && visibleRows.length === selectedRows.length
    )
  }, [])

  return (
    <Grid>
      <Stack direction="row" spacing={1} component="div" mb={2}>
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
      </Stack>
      <BCGridViewer
        gridKey="notifications-grid"
        gridRef={gridRef}
        alertRef={alertRef}
        columnDefs={columnDefs(t, currentUser)}
        query={useGetNotificationMessages}
        dataKey="notifications"
        overlayNoRowsTemplate={t('notifications:noNotificationsFound')}
        autoSizeStrategy={{
          type: 'fitGridWidth',
          defaultMinWidth: 50,
          defaultMaxWidth: 600
        }}
        rowSelection={rowSelection}
        rowClassRules={rowClassRules}
        onCellClicked={onCellClicked}
        selectionColumnDef={selectionColumnDef}
        onSelectionChanged={onSelectionChanged}
        onRowClicked={handleRowClicked}
      />
    </Grid>
  )
}
