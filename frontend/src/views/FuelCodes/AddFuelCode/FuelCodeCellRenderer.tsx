import type { ICellRendererParams } from 'ag-grid-community'
import type { ReactNode } from 'react'
import BCTypography from '@/components/BCTypography'

interface FuelCodeCellRendererProps {
  params: ICellRendererParams
  field: string
  customRenderer: ((params: ICellRendererParams) => ReactNode) | null
}

export const FuelCodeCellRenderer = ({
  params,
  field,
  customRenderer
}: FuelCodeCellRendererProps) => {
  const hasError =
    params.data?.id && params.context.errors[params.data.id]?.includes(field)
  const content = customRenderer
    ? customRenderer(params)
    : params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>)

  return <div style={{ color: hasError ? 'red' : 'inherit' }}>{content}</div>
}
