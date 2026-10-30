import type { ColDef } from 'ag-grid-community'
import { Link } from 'react-router-dom'
import { ROUTES, buildPath } from '@/routes/routes'
import type { FuelCodeCellParams } from '../_schema'

interface FuelCodeLinkCellRendererProps {
  params: FuelCodeCellParams
  originalRenderer?: ColDef['cellRenderer']
}

const fuelCodeDetailPath = (fuelCodeId: unknown): string | null => {
  const id = Number(fuelCodeId)
  if (!Number.isInteger(id) || id <= 0) return null
  return buildPath(ROUTES.FUEL_CODES.VIEW, { fuelCodeID: id })
}

export const FuelCodeLinkCellRenderer = ({
  params,
  originalRenderer
}: FuelCodeLinkCellRendererProps) => {
  const path = fuelCodeDetailPath(params.data?.fuelCodeId)
  const content =
    typeof originalRenderer === 'function'
      ? originalRenderer(params)
      : params.valueFormatted || params.value || ''

  if (!path) return content

  return (
    <Link
      to={path}
      style={{
        color: 'inherit',
        display: 'block',
        height: '100%',
        textDecoration: 'none',
        width: '100%'
      }}
    >
      {content}
    </Link>
  )
}
