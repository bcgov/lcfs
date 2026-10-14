import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import type {
  BCBadgeColor,
  BCBadgeVariant,
  BCBadgeSize
} from '@/components/BCBadge/BCBadgeRoot'
import type { ReactNode, ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { RendererProps, RendererWithFilterPill } from './cellRenderers'

interface CreateStatusRendererOptions {
  statusField?: string
  defaultColor?: BCBadgeColor
  variant?: BCBadgeVariant
  size?: BCBadgeSize
  minWidth?: string
  fontSize?: string
  padding?: string
  fontWeight?: string
  textTransform?: string | null
  replaceUnderscores?: boolean
  margin?: number
  enableLink?: boolean
  urlGenerator?: ((args: { data: unknown; node: unknown }) => string) | null
}

export const createStatusRenderer = (
  colorMap: Record<string, BCBadgeColor>,
  options: CreateStatusRendererOptions = {},
  value: string | undefined = undefined
): RendererWithFilterPill => {
  const {
    statusField = 'status',
    defaultColor = 'info',
    variant = 'contained',
    size = 'lg',
    minWidth = '120px',
    fontSize = '0.875rem',
    padding = '0.4em 0.6em',
    fontWeight = 'regular',
    textTransform = null,
    replaceUnderscores = false,
    margin = 1,
    enableLink = false,
    urlGenerator = null
  } = options

  const buildBadge = (statusValue: string): ReactNode => {
    if (!statusValue) return null
    let displayText: string = statusValue
    if (replaceUnderscores && typeof displayText === 'string') {
      displayText = displayText.replace(/_/g, ' ')
    }
    const badgeColor = colorMap[statusValue] || defaultColor

    return (
      <BCBadge
        badgeContent={displayText}
        color={badgeColor}
        variant={variant}
        size={size}
        sx={{
          '& .MuiBadge-badge': {
            minWidth,
            fontWeight,
            fontSize,
            padding,
            ...(textTransform && { textTransform })
          }
        }}
      />
    )
  }

  const StatusRendererComponent: RendererWithFilterPill = (
    props: RendererProps
  ): ReactElement => {
    const { data, node } = props
    const location = useLocation()

    let statusValue: unknown = statusField.includes('.')
      ? statusField.split('.').reduce<unknown>((obj, key) => obj?.[key], data)
      : data[statusField]
    if (
      statusValue &&
      typeof statusValue === 'object' &&
      statusValue !== null &&
      !Array.isArray(statusValue)
    ) {
      statusValue = statusValue.status || statusValue
    }
    if (value !== undefined) {
      statusValue = value
    }
    const badgeNode = buildBadge(statusValue)
    const component = (
      <BCBox
        m={margin}
        sx={{
          display: 'flex',
          justifyContent: 'center'
        }}
        component="span"
      >
        {badgeNode}
      </BCBox>
    )

    if (enableLink) {
      const targetUrl = urlGenerator
        ? urlGenerator({ data, node })
        : `${location.pathname}/${node?.id}`

      return (
        <Link to={targetUrl} style={{ color: '#000' }}>
          {component}
        </Link>
      )
    }

    return component
  }

  StatusRendererComponent.filterPillRenderer = ({
    rawValue,
    value: pillValue
  }) => {
    const pillStatusValue = (rawValue || pillValue) as string
    if (!pillStatusValue) {
      return null
    }
    return buildBadge(pillStatusValue)
  }

  return StatusRendererComponent
}
