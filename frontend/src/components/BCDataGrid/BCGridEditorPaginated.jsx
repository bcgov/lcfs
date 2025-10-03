/* eslint-disable react-hooks/exhaustive-deps */
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { isEqual } from '@/utils/grid/eventHandlers'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import '@ag-grid-community/styles/ag-theme-quartz.css'
import Papa from 'papaparse'
import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { Menu, MenuItem } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import BCModal from '@/components/BCModal'
import { useTranslation } from 'react-i18next'
import { FloatingAlert } from '@/components/BCAlert'
import {
  RequiredHeader,
  AccessibleHeader,
  BCPagination
} from '@/components/BCDataGrid/components'

// Styles for floating pagination
const floatingPaginationStyles = {
  position: 'fixed',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  backgroundColor: 'white',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
  minWidth: '400px',
  maxWidth: '90vw'
}

const normalPaginationStyles = {
  maxHeight: '4rem',
  position: 'relative',
  alignItems: 'center',
  '& .MuiTablePagination-toolbar p': { paddingTop: '0.1rem !important' }
}

const floatingScrollStyles = {
  position: 'fixed',
  bottom: '0.25rem',
  left: 0,
  right: 0,
  top: 55,
  overflowX: 'auto',
  height: '16px',
  zIndex: 999,
  background: '#fafafa'
}

const isIntersectionObserverSupported = () => {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window
}

/**
 * Hybrid Grid Editor with Pagination
 * Combines editing capabilities with server-side pagination
 *
 * @typedef {Object} BCGridEditorPaginatedProps
 * @property {React.Ref<any>} gridRef
 * @property {React.Ref<any>} alertRef
 * @property {Function} handlePaste
 * @property {Function} onAction
 * @property {Function} onAddRows
 * @property {Function} onCellEditingStopped
 * @property {Function} onCellValueChanged
 * @property {Object} paginationOptions - Current pagination state
 * @property {Function} onPaginationChange - Callback when pagination changes
 * @property {Object} queryData - Data object with pagination info
 * @property {string} dataKey - Key to access items in data object
 * @property {boolean} suppressPagination - Hide pagination controls
 * @property {string} gridKey - Unique key for caching
 * @property {boolean} enablePageCaching - Enable pagination state caching
 * @property {Array} paginationPageSizeSelector - Page size options
 * @property {boolean} enableFloatingPagination - Enable floating pagination
 */
export const BCGridEditorPaginated = ({
  gridRef = useRef(null),
  alertRef,
  enablePaste = true,
  handlePaste,
  onCellEditingStopped,
  onCellValueChanged,
  onAction,
  getRowId = (params) => params.data.id,
  showAddRowsButton = true,
  addMultiRow = false,
  saveButtonProps = {
    enabled: false
  },
  showMandatoryColumns = true,
  onAddRows,

  // Pagination props
  suppressPagination = false,
  gridKey,
  paginationOptions = {
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  },
  onPaginationChange,
  queryData,
  dataKey = 'items',
  enableExportButton = false,
  enableCopyButton = false,
  enableResetButton = false,
  enablePageCaching = true,
  paginationPageSizeSelector = [5, 10, 20, 25, 50, 100],
  exportName = 'ExportData',
  enableFloatingPagination = true,
  loading,
  defaultColDef,
  ...props
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef
  const firstEditableColumnRef = useRef(null)
  const [anchorEl, setAnchorEl] = useState(null)
  const buttonRef = useRef(null)
  const { t } = useTranslation(['common'])
  const [showRequiredIndicator, setShowRequiredIndicator] = useState(false)

  // Pagination visibility refs and state
  const paginationRef = useRef(null)
  const gridContainerRef = useRef(null)
  const [isPaginationVisible, setIsPaginationVisible] = useState(true)
  const [isGridVisible, setIsGridVisible] = useState(true)
  const [showScrollbar, setShowScrollbar] = useState(false)

  const hasInitializedFromCache = useRef(false)
  const previousGridKey = useRef(gridKey)
  const isRestoringFromCache = useRef(false)

  const { data, error, isError, isLoading } = queryData || {}
  const isPaginationFloating = !isPaginationVisible && isGridVisible

  // Cache pagination options to sessionStorage
  const cachePaginationOptions = useCallback(
    (options) => {
      if (enablePageCaching && gridKey) {
        const cacheData = {
          page: options.page,
          size: options.size,
          sortOrders: options.sortOrders || [],
          filters: options.filters || []
        }
        sessionStorage.setItem(
          `${gridKey}-pagination`,
          JSON.stringify(cacheData)
        )
      }
    },
    [gridKey, enablePageCaching]
  )

  // Detect required fields
  useEffect(() => {
    if (!showRequiredIndicator && props.columnDefs?.length) {
      const foundRequired = props.columnDefs.some(
        (colDef) => colDef.headerComponent === RequiredHeader
      )
      if (foundRequired && showMandatoryColumns) {
        setShowRequiredIndicator(true)
      }
    }
  }, [props.columnDefs, showRequiredIndicator])

  // Detect scrollbar need
  useEffect(() => {
    const container = gridContainerRef?.current?.querySelector(
      '.ag-center-cols-viewport'
    )
    const content = gridContainerRef?.current?.querySelector(
      '.ag-center-cols-container'
    )

    if (container && content) {
      setShowScrollbar(content.scrollWidth > container.clientWidth)
    }
  }, [data])

  // Initialize with cached pagination options if available
  useEffect(() => {
    if (enablePageCaching && gridKey && !hasInitializedFromCache.current) {
      const cachedPagination = sessionStorage.getItem(`${gridKey}-pagination`)
      if (cachedPagination) {
        try {
          const cachedOptions = JSON.parse(cachedPagination)
          const restoredOptions = {
            ...paginationOptions,
            ...cachedOptions
          }
          hasInitializedFromCache.current = true
          onPaginationChange?.(restoredOptions)
        } catch (error) {
          console.warn('Failed to parse cached pagination options:', error)
        }
      }
    }
  }, [enablePageCaching, gridKey])

  // Reset initialization flag when gridKey changes
  useEffect(() => {
    if (previousGridKey.current !== gridKey) {
      hasInitializedFromCache.current = false
      isRestoringFromCache.current = false
      previousGridKey.current = gridKey
    }
  }, [gridKey])

  // Intersection Observer for floating pagination
  useEffect(() => {
    if (
      !enableFloatingPagination ||
      suppressPagination ||
      !paginationRef.current ||
      !gridContainerRef.current ||
      !isIntersectionObserverSupported()
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === paginationRef.current) {
            setIsPaginationVisible(entry.isIntersecting)
          } else if (entry.target === gridContainerRef.current) {
            setIsGridVisible(entry.isIntersecting)
          }
        })
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      }
    )

    observer.observe(paginationRef.current)
    observer.observe(gridContainerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [enableFloatingPagination, suppressPagination, data])

  const handleGridReady = useCallback(
    (params) => {
      if (!showRequiredIndicator) {
        const actualCols = params.api.getColumnDefs() || []
        const foundRequired = actualCols.some(
          (colDef) => colDef.headerComponent === RequiredHeader
        )
        if (foundRequired) {
          setShowRequiredIndicator(true)
        }
      }

      // Restore filter and column state
      const filterState = JSON.parse(
        sessionStorage.getItem(`${gridKey}-filter`)
      )
      const columnState = JSON.parse(
        sessionStorage.getItem(`${gridKey}-column`)
      )

      if (filterState) {
        isRestoringFromCache.current = true
        params.api.setFilterModel(filterState)

        if (!enablePageCaching || !hasInitializedFromCache.current) {
          const filterArr = [
            ...Object.entries(filterState).map(([field, value]) => {
              return { field, ...value }
            })
          ]
          const updatedOptions = {
            ...paginationOptions,
            page: 1,
            filters: filterArr
          }
          onPaginationChange?.(updatedOptions)
          if (enablePageCaching) {
            cachePaginationOptions(updatedOptions)
          }
        }

        setTimeout(() => {
          isRestoringFromCache.current = false
        }, 100)
      }

      if (columnState) {
        params.api.applyColumnState({
          state: columnState,
          applyOrder: true
        })
      } else if (paginationOptions.sortOrders?.length > 0) {
        const state = paginationOptions.sortOrders.map((col) => ({
          colId: col.field,
          sort: col.direction
        }))
        params.api.applyColumnState({
          state,
          defaultState: { sort: null }
        })
      }

      props.onGridReady?.(params)
    },
    [
      showRequiredIndicator,
      gridKey,
      enablePageCaching,
      paginationOptions,
      cachePaginationOptions
    ]
  )

  const findFirstEditableColumn = useCallback(() => {
    if (!ref.current?.api) return null

    if (!firstEditableColumnRef.current) {
      const columns = ref.current.api.getAllDisplayedColumns()
      firstEditableColumnRef.current = columns.find(
        (col) =>
          col.colDef.editable !== false &&
          !['action', 'checkbox'].includes(col.colDef.field)
      )
    }
    return firstEditableColumnRef.current
  }, [])

  const startEditingFirstEditableCell = useCallback(
    (rowIndex) => {
      if (!ref.current?.api) return

      const firstEditableColumn = findFirstEditableColumn()
      if (!firstEditableColumn) return

      setTimeout(() => {
        ref.current.api.ensureIndexVisible(rowIndex)
        ref.current.api.setFocusedCell(rowIndex, firstEditableColumn.getColId())
        ref.current.api.startEditingCell({
          rowIndex,
          colKey: firstEditableColumn.getColId()
        })
      }, 100)
    },
    [findFirstEditableColumn]
  )

  const handleExcelPaste = useCallback(
    (params) => {
      const newData = []
      const clipboardData = params.clipboardData || window.clipboardData
      const pastedData = clipboardData.getData('text/plain')
      const headerRow = ref.current.api
        .getAllDisplayedColumns()
        .map((column) => column.colDef.field)
        .filter((col) => col)
        .join('\t')
      const parsedData = Papa.parse(headerRow + '\n' + pastedData, {
        delimiter: '\t',
        header: true,
        transform: (value) => {
          const num = Number(value)
          return isNaN(num) ? value : num
        },
        skipEmptyLines: true
      })
      if (parsedData.data.length < 0 || parsedData.data[1].length < 2) {
        return
      }
      parsedData.data.forEach((row) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newData.push(newRow)
      })
      const transactions = ref.current.api.applyTransaction({ add: newData })
      transactions.add.forEach((node) => {
        onCellEditingStopped({
          node,
          oldValue: '',
          newValue: node.data[findFirstEditableColumn()],
          ...props
        })
      })
    },
    [findFirstEditableColumn, onCellEditingStopped, props, ref]
  )

  useEffect(() => {
    const pasteHandler = (event) => {
      const gridApi = ref.current?.api
      const columnApi = ref.current?.columnApi

      if (handlePaste) {
        handlePaste(event, { api: gridApi, columnApi })
      } else {
        handleExcelPaste(event)
      }
    }
    if (enablePaste) {
      window.addEventListener('paste', pasteHandler)
      return () => {
        window.removeEventListener('paste', pasteHandler)
      }
    }
  }, [handleExcelPaste, handlePaste, ref, enablePaste])

  const handleOnCellEditingStopped = useCallback(
    async (params) => {
      if (params.data.modified && !params.data.deleted) {
        if (onCellEditingStopped) {
          onCellEditingStopped(params)
        }
      }
    },
    [onCellEditingStopped]
  )

  const handleOnCellValueChanged = useCallback(
    (params) => {
      if (!isEqual(params.oldValue, params.newValue)) {
        params.data.modified = true
      }
      if (onCellValueChanged) {
        onCellValueChanged(params)
      }
    },
    [onCellValueChanged]
  )

  const onCellClicked = async (params) => {
    if (
      params.column.colId === 'action' &&
      params.event.target.dataset.action &&
      onAction
    ) {
      const action = params.event.target.dataset.action
      const transaction = await onAction(action, params)

      if (transaction?.add?.length > 0) {
        const res = ref.current.api.applyTransaction(transaction)

        if (res.add && res.add.length > 0) {
          const firstNewRow = res.add[0]
          startEditingFirstEditableCell(firstNewRow.rowIndex)
        }
      }
    }
  }

  const onCellFocused = (params) => {
    if (params.column) {
      const COLUMN_BUFFER = 20
      const { left, right } = params.api.getHorizontalPixelRange()
      const columnRight = params.column.left + params.column.actualWidth
      if (
        params.column.left < left + COLUMN_BUFFER ||
        columnRight > right - COLUMN_BUFFER
      ) {
        params.api.ensureColumnVisible(params.column, 'middle')
      }
    }
  }

  const handleAddRowsClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleAddRowsClose = () => {
    setAnchorEl(null)
  }

  const handleAddRowsInternal = useCallback(
    async (numRows) => {
      let newRows = []

      if (onAction) {
        try {
          for (let i = 0; i < numRows; i++) {
            const transaction = await onAction('add')
            if (transaction?.add?.length > 0) {
              newRows = [...newRows, ...transaction.add]
            }
          }
        } catch (error) {
          console.error('Error during onAction add:', error)
        }
      }

      if (newRows.length === 0) {
        newRows = Array(numRows)
          .fill()
          .map(() => ({ id: uuid() }))
      }

      const result = ref.current.api.applyTransaction({
        add: newRows,
        addIndex: ref.current.api.getDisplayedRowCount()
      })

      if (result.add && result.add.length > 0) {
        startEditingFirstEditableCell(result.add[0].rowIndex)
      }

      setAnchorEl(null)
    },
    [onAction, startEditingFirstEditableCell]
  )

  // Pagination handlers
  const handleChangePage = (_, newPage) => {
    const updatedOptions = { ...paginationOptions, page: newPage + 1 }
    onPaginationChange?.(updatedOptions)
    if (enablePageCaching) {
      cachePaginationOptions(updatedOptions)
    }
  }

  const handleChangeRowsPerPage = (event) => {
    const updatedOptions = {
      ...paginationOptions,
      page: 1,
      size: parseInt(event.target.value, 10)
    }
    onPaginationChange?.(updatedOptions)
    if (enablePageCaching) {
      cachePaginationOptions(updatedOptions)
    }
  }

  const handleFilterChanged = useCallback(
    (grid) => {
      if (isRestoringFromCache.current) {
        return
      }

      const gridFilters = grid.api.getFilterModel()
      const filterArr = [
        ...Object.entries(gridFilters).map(([field, value]) => {
          return { field, ...value }
        })
      ]

      const updatedOptions = {
        ...paginationOptions,
        page: 1,
        filters: filterArr
      }
      onPaginationChange?.(updatedOptions)
      if (enablePageCaching) {
        cachePaginationOptions(updatedOptions)
      }
      sessionStorage.setItem(`${gridKey}-filter`, JSON.stringify(gridFilters))
    },
    [
      gridKey,
      onPaginationChange,
      paginationOptions,
      enablePageCaching,
      cachePaginationOptions
    ]
  )

  const handleSortChanged = useCallback(() => {
    const sortTemp = ref.current?.api
      .getColumnState()
      .filter((col) => col.sort)
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((col) => {
        return {
          field: col.colId,
          direction: col.sort
        }
      })

    const updatedOptions = { ...paginationOptions, sortOrders: sortTemp }
    onPaginationChange?.(updatedOptions)
    if (enablePageCaching) {
      cachePaginationOptions(updatedOptions)
    }
    sessionStorage.setItem(
      `${gridKey}-column`,
      JSON.stringify(ref.current?.api.getColumnState())
    )
  }, [
    gridKey,
    onPaginationChange,
    paginationOptions,
    enablePageCaching,
    cachePaginationOptions
  ])

  const isGridValid = () => {
    let isValid = true

    ref.current.api.forEachNode((node) => {
      if (!node.data || node.data.validationStatus === 'error') {
        isValid = false
      }
    })

    return isValid
  }

  const [showCloseModal, setShowCloseModal] = useState(false)
  const onSaveExit = () => {
    const isValid = isGridValid()
    if (isValid) {
      saveButtonProps.onSave()
      return
    }

    setShowCloseModal(true)
  }

  const defaultColDefParams = {
    headerComponentParams: {
      innerHeaderComponent: AccessibleHeader
    },
    suppressHeaderFilterButton: true,
    resizable: true,
    sortable: true,
    filter: true,
    filterParams: {
      maxNumConditions: 1
    },
    floatingFilter: true,
    floatingFilterComponentParams: {
      browserAutoComplete: false
    }
  }

  return (
    <BCBox
      ref={gridContainerRef}
      my={2}
      component="div"
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <FloatingAlert dismissible={true} ref={alertRef} data-test="alert-box" />
      {showRequiredIndicator && (
        <BCTypography
          variant="body4"
          color="text"
          component="div"
          dangerouslySetInnerHTML={{ __html: t('asterisk') }}
        />
      )}
      <BCGridBase
        ref={ref}
        className="ag-theme-quartz"
        onGridReady={handleGridReady}
        onCellValueChanged={handleOnCellValueChanged}
        undoRedoCellEditing
        undoRedoCellEditingLimit={5}
        enableBrowserTooltips
        getRowId={getRowId}
        onCellClicked={onCellClicked}
        onCellEditingStopped={handleOnCellEditingStopped}
        onCellFocused={onCellFocused}
        onSortChanged={handleSortChanged}
        onFilterChanged={handleFilterChanged}
        autoHeight={false}
        loading={isLoading || loading}
        rowData={!isLoading && ((data && data[dataKey]) || [])}
        defaultColDef={{
          ...defaultColDefParams,
          ...defaultColDef
        }}
        {...props}
      />

      {/* Pagination Controls */}
      {!suppressPagination && (
        <>
          <BCBox
            ref={paginationRef}
            className="ag-grid-pagination-container"
            display="flex"
            justifyContent="flex-start"
            variant="outlined"
            sx={{
              ...normalPaginationStyles,
              visibility:
                isPaginationFloating && enableFloatingPagination
                  ? 'hidden'
                  : 'visible'
            }}
          >
            <BCPagination
              page={data?.pagination?.page || paginationOptions.page || 1}
              size={data?.pagination?.size || paginationOptions.size || 10}
              total={data?.pagination?.total ?? data?.total_count ?? 0}
              handleChangePage={handleChangePage}
              handleChangeRowsPerPage={handleChangeRowsPerPage}
              enableResetButton={enableResetButton}
              enableCopyButton={enableCopyButton}
              enableExportButton={enableExportButton}
              exportName={exportName}
              gridRef={ref}
              rowsPerPageOptions={paginationPageSizeSelector}
            />
          </BCBox>

          {/* Floating pagination */}
          {isPaginationFloating &&
            enableFloatingPagination &&
            (data?.pagination?.size || paginationOptions.size || 10) > 10 &&
            (data?.pagination?.total || paginationOptions.total || 10) > 10 && (
              <BCBox
                className="ag-grid-pagination-container-floating"
                display="flex"
                justifyContent="center"
                variant="outlined"
                sx={{
                  ...floatingPaginationStyles,
                  animation: 'fadeInUp 0.3s ease-out'
                }}
              >
                {showScrollbar && (
                  <div
                    className="custom-horizontal-scroll"
                    style={{ ...floatingScrollStyles }}
                    onScroll={(e) => {
                      const scrollLeft = e.target.scrollLeft
                      const centerViewport =
                        gridContainerRef?.current?.querySelector(
                          '.ag-center-cols-viewport'
                        )
                      if (centerViewport) {
                        centerViewport.scrollLeft = scrollLeft
                      }
                    }}
                  >
                    <div
                      style={{
                        width: ref.current?.api
                          ? gridContainerRef?.current?.querySelector(
                              '.ag-body-horizontal-scroll-viewport'
                            )?.scrollWidth ||
                            gridContainerRef?.current?.querySelector(
                              '.ag-header-viewport'
                            )?.scrollWidth ||
                            '100%'
                          : '100%',
                        height: '1px'
                      }}
                    />
                  </div>
                )}
                <BCPagination
                  page={data?.pagination?.page || paginationOptions.page || 1}
                  size={data?.pagination?.size || paginationOptions.size || 10}
                  total={data?.pagination?.total ?? data?.total_count ?? 0}
                  handleChangePage={handleChangePage}
                  handleChangeRowsPerPage={handleChangeRowsPerPage}
                  enableResetButton={enableResetButton}
                  enableCopyButton={enableCopyButton}
                  enableExportButton={enableExportButton}
                  exportName={exportName}
                  gridRef={ref}
                  rowsPerPageOptions={paginationPageSizeSelector}
                />
              </BCBox>
            )}
        </>
      )}

      {/* Action Buttons */}
      <BCBox flex={1} mt={2} mx={0} ml={-2}>
        {showAddRowsButton && (
          <>
            <BCButton
              ref={buttonRef}
              variant="outlined"
              data-test="add-row-btn"
              color="dark"
              startIcon={
                <FontAwesomeIcon icon={faPlus} className="small-icon" />
              }
              endIcon={
                addMultiRow && (
                  <FontAwesomeIcon icon={faCaretDown} className="small-icon" />
                )
              }
              onClick={
                addMultiRow
                  ? handleAddRowsClick
                  : () => handleAddRowsInternal(1)
              }
            >
              Add row
            </BCButton>
            {addMultiRow && (
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleAddRowsClose}
                slotProps={{
                  paper: {
                    style: {
                      width: buttonRef.current?.offsetWidth
                    }
                  }
                }}
              >
                <MenuItem onClick={() => handleAddRowsInternal(1)}>
                  1 row
                </MenuItem>
                <MenuItem onClick={() => handleAddRowsInternal(5)}>
                  5 rows
                </MenuItem>
                <MenuItem onClick={() => handleAddRowsInternal(10)}>
                  10 rows
                </MenuItem>
              </Menu>
            )}
          </>
        )}
        {saveButtonProps.enabled && (
          <>
            <BCButton
              onClick={onSaveExit}
              variant="contained"
              data-test="save-btn"
              color="primary"
              style={{
                marginLeft: 20
              }}
            >
              {saveButtonProps.text}
            </BCButton>
            <BCModal
              open={showCloseModal}
              onClose={() => {
                setShowCloseModal(false)
              }}
              data={{
                title: saveButtonProps.text,
                content: saveButtonProps.confirmText,
                primaryButtonAction: saveButtonProps.onSave,
                primaryButtonText: saveButtonProps.confirmLabel,
                secondaryButtonText: t('cancelBtn')
              }}
            />
          </>
        )}
      </BCBox>

      {/* CSS for animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </BCBox>
  )
}

BCGridEditorPaginated.propTypes = {
  gridRef: PropTypes.shape({ current: PropTypes.any }),
  alertRef: PropTypes.shape({ current: PropTypes.any }),
  handlePaste: PropTypes.func,
  onAction: PropTypes.func,
  onAddRows: PropTypes.func,
  onCellEditingStopped: PropTypes.func,
  onCellValueChanged: PropTypes.func,
  showAddRowsButton: PropTypes.bool,
  addMultiRow: PropTypes.bool,
  saveButtonProps: PropTypes.shape({
    enabled: PropTypes.bool,
    text: PropTypes.string,
    onSave: PropTypes.func,
    confirmText: PropTypes.string,
    confirmLabel: PropTypes.string
  }),
  onGridReady: PropTypes.func,
  suppressPagination: PropTypes.bool,
  gridKey: PropTypes.string,
  paginationOptions: PropTypes.shape({
    page: PropTypes.number,
    size: PropTypes.number,
    sortOrders: PropTypes.array,
    filters: PropTypes.array
  }),
  onPaginationChange: PropTypes.func,
  queryData: PropTypes.object,
  dataKey: PropTypes.string,
  enableExportButton: PropTypes.bool,
  enableCopyButton: PropTypes.bool,
  enableResetButton: PropTypes.bool,
  enablePageCaching: PropTypes.bool,
  paginationPageSizeSelector: PropTypes.array,
  exportName: PropTypes.string,
  enableFloatingPagination: PropTypes.bool,
  loading: PropTypes.bool
}
