import { Alert, Box } from '@mui/material'
import { BCResponsiveEChart } from '@/components/charts/BCResponsiveEchart'
import { ChartSpec } from './types'

interface ChartRendererProps {
  chart: ChartSpec
}

export const ChartRenderer = ({ chart }: ChartRendererProps) => {
  if (!chart || chart.chartType === 'table') {
    return <Alert severity="info">This result is better shown as a table.</Alert>
  }

  return (
    <Box>
      <BCResponsiveEChart
        option={chart.option}
        height={360}
        ariaLabel={chart.title}
      />
    </Box>
  )
}
