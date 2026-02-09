import React, { useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FormControl,
  MenuItem,
  Select,
  Stack,
  Typography,
  IconButton,
  Box
} from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import Loading from '@/components/Loading'
import {
  useGetCompliancePeriodList,
  useGetLookupTableData
} from '@/hooks/useCalculator'
import { CURRENT_COMPLIANCE_YEAR } from '@/constants/common'
import { lookupTableColumnDefs } from './_schema'

export const LookupTableView = () => {
  const { t } = useTranslation(['common'])
  const gridRef = useRef(null)

  // Fetch compliance periods from API
  const { data: compliancePeriods, isLoading: isLoadingPeriods } =
    useGetCompliancePeriodList()

  // Transform compliance periods data for select input
  const formattedCompliancePeriods = useMemo(() => {
    if (!compliancePeriods?.data?.length) return []

    return compliancePeriods.data
      .map((period) => ({
        value: period.description,
        label: period.description
      }))
      .filter((period) => {
        const year = parseInt(period.value)
        return year >= 2019 && year <= 2030
      })
      .sort((a, b) => parseInt(b.value) - parseInt(a.value))
  }, [compliancePeriods])

  // Get the default compliance period from constant
  const defaultCompliancePeriod = useMemo(() => {
    if (!formattedCompliancePeriods.length) {
      return CURRENT_COMPLIANCE_YEAR
    }

    // Default to current compliance year
    const matchedPeriod = formattedCompliancePeriods.find(
      (p) => p.value === CURRENT_COMPLIANCE_YEAR
    )
    return matchedPeriod
      ? matchedPeriod.value
      : formattedCompliancePeriods[0]?.value
  }, [formattedCompliancePeriods])

  const [selectedYear, setSelectedYear] = useState(defaultCompliancePeriod)

  // Fetch lookup table data
  const { data: lookupTableData, isLoading: isLoadingData } =
    useGetLookupTableData(selectedYear)

  // Handle year navigation
  const handlePreviousYear = () => {
    const currentIndex = formattedCompliancePeriods.findIndex(
      (p) => p.value === selectedYear
    )
    if (currentIndex < formattedCompliancePeriods.length - 1) {
      setSelectedYear(formattedCompliancePeriods[currentIndex + 1].value)
    }
  }

  const handleNextYear = () => {
    const currentIndex = formattedCompliancePeriods.findIndex(
      (p) => p.value === selectedYear
    )
    if (currentIndex > 0) {
      setSelectedYear(formattedCompliancePeriods[currentIndex - 1].value)
    }
  }

  const canGoPrevious =
    formattedCompliancePeriods.findIndex((p) => p.value === selectedYear) <
    formattedCompliancePeriods.length - 1

  const canGoNext =
    formattedCompliancePeriods.findIndex((p) => p.value === selectedYear) > 0

  const columnDefs = useMemo(() => lookupTableColumnDefs, [])

  const rowData = useMemo(() => {
    if (!lookupTableData?.data?.data) return []
    return lookupTableData.data.data
  }, [lookupTableData])

  if (isLoadingPeriods) {
    return <Loading />
  }

  return (
    <BCBox sx={{ mb: 15 }}>
      <Stack spacing={3}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            width: 'fit-content'
          }}
        >
          <IconButton
            onClick={handlePreviousYear}
            disabled={!canGoPrevious}
            size="small"
            sx={{
              backgroundColor: '#003366',
              color: 'white !important',
              borderRadius: '50%',
              width: 25,
              height: 25,
              padding: 0,
              fontSize: '18px',
              '& .MuiSvgIcon-root': {
                color: 'white',
                fontSize: '18px !important'
              },
              '&:hover': {
                backgroundColor: '#004080',
                '& .MuiSvgIcon-root': {
                  color: 'white'
                }
              },
              '&.Mui-disabled': {
                backgroundColor: '#c0c0c0',
                color: '#808080'
              }
            }}
          >
            <ChevronLeft />
          </IconButton>
          <BCTypography
            variant="h4"
            fontWeight="bold"
            sx={{ 
              minWidth: '80px', 
              textAlign: 'center',
              color: '#003366'
            }}
          >
            {selectedYear}
          </BCTypography>
          <IconButton
            onClick={handleNextYear}
            disabled={!canGoNext}
            size="small"
            sx={{
              backgroundColor: '#003366',
              color: 'white !important',
              borderRadius: '50%',
              width: 25,
              height: 25,
              padding: 0,
              fontSize: '18px',
              '& .MuiSvgIcon-root': {
                color: 'white',
                fontSize: '18px !important'
              },
              '&:hover': {
                backgroundColor: '#004080',
                '& .MuiSvgIcon-root': {
                  color: 'white'
                }
              },
              '&.Mui-disabled': {
                backgroundColor: '#c0c0c0',
                color: '#808080'
              }
            }}
          >
            <ChevronRight />
          </IconButton>
        </Box>

        <BCBox>
          {isLoadingData ? (
            <Loading />
          ) : rowData.length === 0 ? (
            <Typography
              variant="body1"
              color="text.secondary"
              align="center"
              py={4}
            >
              No data available for the selected year.
            </Typography>
          ) : (
            <BCGridViewer
              gridRef={gridRef}
              gridKey="lookup-table-grid"
              columnDefs={columnDefs}
              rowData={rowData}
              suppressPagination={true}
              defaultColDef={{
                sortable: true,
                resizable: true,
                filter: false,
                floatingFilter: false,
                menuTabs: []
              }}
              paginationOptions={{
                page: 1,
                size: 10000,
                sortOrders: [],
                filters: []
              }}
              onPaginationChange={() => {}}
              queryData={{
                data: { items: rowData },
                isLoading: isLoadingPeriods
              }}
              dataKey="items"
            />
          )}
        </BCBox>
      </Stack>
    </BCBox>
  )
}
