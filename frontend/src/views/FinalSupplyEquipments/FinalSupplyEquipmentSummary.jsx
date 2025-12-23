import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { finalSupplyEquipmentSummaryColDefs } from '@/views/FinalSupplyEquipments/_schema.jsx'
import { defaultInitialPagination } from '@/constants/schedules'
import GeoMapping from './GeoMapping'
import FSEFullMap from './FSEFullMap'
import { Box, Tab, Tabs } from '@mui/material'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { useGetFSEReportingList } from '@/hooks/useFinalSupplyEquipment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import { TableView, Map as MapIcon } from '@mui/icons-material'

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`fse-tabpanel-${index}`}
      aria-labelledby={`fse-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

function a11yProps(index) {
  return {
    id: `fse-tab-${index}`,
    'aria-controls': `fse-tabpanel-${index}`
  }
}

export const FinalSupplyEquipmentSummary = ({
  data,
  status,
  organizationId
}) => {
  const [tabValue, setTabValue] = useState(0)
  const [showPageMap, setShowPageMap] = useState(false)
  const { complianceReportId } = useParams()
  const { hasAnyRole } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )
  const queryData = useGetFSEReportingList(
    complianceReportId,
    paginationOptions,
    {},
    organizationId,
    'summary'
  )
  const { data: fseData, isLoading, isError, refetch } = queryData

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'finalSupplyEquipment'])

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue)
  }

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      enableCellTextSelection: true,
      ensureDomOrder: true
    }),
    [t]
  )

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'final-supply-equipments'
      }
    }),
    [status]
  )

  const columns = useMemo(() => {
    return finalSupplyEquipmentSummaryColDefs(t, status, isIDIR)
  }, [t, status, isIDIR])

  const getRowId = (params) => {
    return String(params.data.chargingEquipmentId)
  }
  const handlePaginationChange = useCallback((newPaginationOptions) => {
    setPaginationOptions(newPaginationOptions)
  }, [])

  return (
    <Grid2 className="final-supply-equipment-container" mx={-1}>
      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="FSE view tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 48,
              fontWeight: 500
            }
          }}
        >
          <Tab
            icon={<TableView sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label={t('finalSupplyEquipment:fseGridTab')}
            {...a11yProps(0)}
          />
          <Tab
            icon={<MapIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label={t('finalSupplyEquipment:fseMapTab')}
            {...a11yProps(1)}
          />
        </Tabs>
      </Box>

      {/* FSE Grid Tab */}
      <TabPanel value={tabValue} index={0}>
        <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
          <BCGridViewer
            gridKey="final-supply-equipments"
            gridRef={gridRef}
            columnDefs={columns}
            queryData={queryData}
            dataKey="finalSupplyEquipments"
            getRowId={getRowId}
            gridOptions={gridOptions}
            enableCopyButton={false}
            defaultColDef={defaultColDef}
            suppressPagination={(fseData?.pagination?.total || 0) <= 10}
            paginationOptions={paginationOptions}
            onPaginationChange={handlePaginationChange}
            enablePageCaching={false}
          />
        </BCBox>
        <>
          {/* Toggle Map Switch for current page view */}
          <FormControlLabel
            control={
              <Switch
                sx={{ mt: -1 }}
                checked={showPageMap}
                onChange={() => setShowPageMap(!showPageMap)}
              />
            }
            label={
              showPageMap
                ? t('finalSupplyEquipment:hidePageMap')
                : t('finalSupplyEquipment:showPageMap')
            }
            sx={{ mt: 2 }}
          />

          {/* Conditional Rendering of Page-specific MapComponent */}
          {showPageMap && (
            <GeoMapping
              complianceReportId={complianceReportId}
              data={fseData}
            />
          )}
        </>
      </TabPanel>

      {/* FSE map tab - shows all FSE entries on a single map */}
      <TabPanel value={tabValue} index={1}>
        <FSEFullMap organizationId={organizationId} />
      </TabPanel>
    </Grid2>
  )
}

FinalSupplyEquipmentSummary.displayName = 'FinalSupplyEquipmentSummary'
