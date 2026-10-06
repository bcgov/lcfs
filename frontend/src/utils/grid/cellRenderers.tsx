import { createStatusRenderer } from './createStatusRenderer'
import BCBadge from '@/components/BCBadge'
import type { BCBadgeColor } from '@/components/BCBadge/BCBadgeRoot'
import BCBox from '@/components/BCBox'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
import { roles } from '@/constants/roles'
import {
  COMPLIANCE_REPORT_STATUSES,
  getAllFuelCodeStatuses,
  getAllOrganizationStatuses,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES
} from '@/constants/statuses'
import { getOrgTypeDisplayLabel } from '@/utils/organizationTypes'
import { Link, useLocation } from 'react-router-dom'
import {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import colors from '@/themes/base/colors'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { getCode } from 'country-list'

// Loose typing because these renderers are consumed by AG Grid and many
// consumers across the codebase pass through additional ad-hoc props.
export type RendererProps = {
  value?: unknown
  valueFormatted?: unknown
  data?: unknown
  node?: unknown
  colDef?: unknown
  api?: unknown
  url?: (params: { data: unknown }) => string
  isAbsolute?: boolean
  isView?: boolean
  state?: (data: unknown) => unknown
  [key: string]: unknown
}

interface ChipConfig {
  maxWidth?: number
  [key: string]: unknown
}

interface ChipDescriptor {
  text: string
  width: number
  maxWidth?: number
  [key: string]: unknown
}

export const TextRenderer = (props: RendererProps): ReactElement => {
  return (
    <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
      {props.valueFormatted || props.value}
    </BCBox>
  )
}

export const LinkRenderer = (props: RendererProps): ReactElement => {
  const location = useLocation()

  const baseUrl = props.isAbsolute ? '' : `${location.pathname}/`
  const targetUrl =
    baseUrl +
    ((props.url && props.url({ data: props.data })) || props?.node?.id)
  return (
    <Link
      to={targetUrl}
      state={props.state && props.state(props.data)}
      style={{ color: '#000' }}
    >
      <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
        {props.valueFormatted || props.value}
      </BCBox>
    </Link>
  )
}

export const SelectRenderer = (params: RendererProps): ReactElement => {
  const cellParams = params.colDef?.cellEditorParams

  const options =
    typeof cellParams === 'function'
      ? cellParams(params).options
      : cellParams.options

  const hasOptions = options?.length > 1

  const isEditable =
    typeof params.colDef.editable === 'function'
      ? params.colDef.editable(params)
      : params.colDef.editable

  const displayValue =
    params.value ?? (hasOptions && isEditable ? 'Select' : '')
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      {displayValue}
      {hasOptions && isEditable && (
        <ArrowDropDown sx={{ height: 22, width: 22, color: '#44474e' }} />
      )}
    </div>
  )
}

export const MultiSelectRenderer = (params: RendererProps): ReactElement => {
  const cellParams = params.colDef?.cellEditorParams

  const options =
    typeof cellParams === 'function'
      ? cellParams(params).options
      : cellParams.options

  const hasOptions = options?.length > 1

  const isEditable =
    typeof params.colDef.editable === 'function'
      ? params.colDef.editable(params)
      : params.colDef.editable
  if (params.value && params.value !== '') {
    const value = Array.isArray(params.value)
      ? params.value?.map(
          (item: unknown) =>
            options.find(
              (opt: { value: unknown; label: unknown }) => opt.value === item
            )?.label || item
        )
      : params.value
    return <CommonArrayRenderer disableLink value={value} />
  }
  const displayValue =
    params.value ?? (hasOptions && isEditable ? 'Select' : '')

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      {displayValue}
      {hasOptions && isEditable && (
        <ArrowDropDown sx={{ height: 22, width: 22, color: '#44474e' }} />
      )}
    </div>
  )
}

export const ConditionalLinkRenderer = (
  condition: (props: RendererProps) => boolean
) => {
  return (props: RendererProps): ReactElement => {
    if (condition(props)) {
      return LinkRenderer(props)
    } else {
      return TextRenderer(props)
    }
  }
}

interface BaseStatusRendererProps {
  isView?: boolean
  value?: boolean
  successText?: string
  failureText?: string
  successColor?: BCBadgeColor
  failureColor?: BCBadgeColor
}

const BaseStatusRenderer = ({
  isView = false,
  value = false,
  successText = 'Active',
  failureText = 'Inactive',
  successColor = 'success',
  failureColor = 'smoky'
}: BaseStatusRendererProps): ReactElement => {
  const badgeStyles = {
    ...(!isView ? { display: 'flex', justifyContent: 'center' } : {}),
    '& .MuiBadge-badge': {
      minWidth: '120px',
      fontWeight: 'regular',
      textTransform: 'capitalize',
      fontSize: '0.875rem',
      padding: '0.4em 0.6em'
    }
  }

  return (
    <BCBox
      component={isView ? 'span' : 'div'}
      mt={1}
      sx={{ width: '100%', height: '100%' }}
    >
      <BCBadge
        badgeContent={value ? successText : failureText}
        color={value ? successColor : failureColor}
        variant="gradient"
        size="md"
        sx={badgeStyles}
      />
    </BCBox>
  )
}

export const StatusRenderer = (props: RendererProps): ReactElement => (
  <BaseStatusRenderer isView={props.isView} value={props.data.isActive} />
)

export const LoginStatusRenderer = (props: RendererProps): ReactElement => (
  <BaseStatusRenderer
    isView={props.isView}
    value={props.data.isLoginSuccessful}
    successText="Success"
    failureText="Failed"
    failureColor="error"
  />
)

interface FilterPillProps {
  rawValue?: unknown
  value?: unknown
}

type FilterPillRenderer = (props: FilterPillProps) => ReactNode

export interface RendererWithFilterPill {
  (props: RendererProps): ReactElement
  filterPillRenderer?: FilterPillRenderer
}

export const OrgStatusRenderer: RendererWithFilterPill = (
  props: RendererProps
): ReactElement => {
  const location = useLocation()
  const statusArr = getAllOrganizationStatuses()
  const statusColorArr: BCBadgeColor[] = ['info', 'success', 'warning', 'error']
  const statusIndex = statusArr.indexOf(props.data.orgStatus.status)
  return (
    <Link
      to={props.node?.id && location.pathname + '/' + props?.node?.id}
      style={{ color: '#000' }}
    >
      <BCBox sx={{ width: '100%', height: '100%' }}>
        <BCBox
          mt={1}
          sx={{
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <BCBadge
            badgeContent={statusArr[statusIndex]}
            color={statusColorArr[statusIndex]}
            variant="contained"
            size="lg"
            sx={{
              '& .MuiBadge-badge': {
                minWidth: '120px',
                fontWeight: 'regular',
                textTransform: 'capitalize',
                fontSize: '0.875rem',
                padding: '0.4em 0.6em'
              }
            }}
          />
        </BCBox>
      </BCBox>
    </Link>
  )
}

OrgStatusRenderer.filterPillRenderer = ({ rawValue }) => {
  const statusValue = (rawValue as string) || ''
  if (!statusValue) return null
  const statusArr = getAllOrganizationStatuses()
  const statusColorArr: BCBadgeColor[] = ['info', 'success', 'warning', 'error']
  const statusIndex = statusArr.indexOf(statusValue as never)

  return (
    <BCBadge
      badgeContent={statusValue}
      color={statusColorArr[statusIndex] || 'info'}
      variant="contained"
      size="lg"
      sx={{
        '& .MuiBadge-badge': {
          minWidth: '120px',
          fontWeight: 'regular',
          textTransform: 'capitalize',
          fontSize: '0.875rem',
          padding: '0.4em 0.6em'
        }
      }}
    />
  )
}

const ORG_TYPE_COLOR_MAP: Record<string, BCBadgeColor> = {
  fuel_supplier: 'info',
  aggregator: 'warning',
  fuel_producer: 'success',
  exempted_supplier: 'secondary',
  initiative_agreement_holder: 'primary',
  credit_trader: 'smoky'
}

const renderOrgTypeBadge = (
  text: string,
  color: BCBadgeColor
): ReactElement => (
  <BCBadge
    badgeContent={text}
    color={color}
    variant="contained"
    size="lg"
    sx={{
      '& .MuiBadge-badge': {
        minWidth: '140px',
        fontWeight: 'regular',
        textTransform: 'capitalize',
        fontSize: '0.85rem',
        padding: '0.35em 0.75em',
        whiteSpace: 'normal',
        lineHeight: 1.2
      }
    }}
  />
)

const renderOrgTypeChip = (text: string, color: BCBadgeColor): ReactElement => (
  <BCBadge
    key={text}
    badgeContent={text}
    color={color}
    variant="contained"
    sx={{
      '& .MuiBadge-badge': {
        fontWeight: 'regular',
        textTransform: 'capitalize',
        fontSize: '0.85rem',
        padding: '0.4em 0.6em'
      },
      margin: '2px'
    }}
  />
)

export const OrgTypeRenderer: RendererWithFilterPill = (
  props: RendererProps
): ReactElement => {
  // Multi-type organizations (#4565): one chip per type with overflow, the
  // same treatment RoleRenderer gives the Users table. Falls back to the
  // legacy single type when the list is absent.
  const orgTypes: unknown[] = props.data?.orgTypes?.length
    ? props.data.orgTypes
    : props.data?.orgType
      ? [props.data.orgType]
      : []
  const colorByLabel: Record<string, BCBadgeColor> = {}
  const labels = orgTypes.map((type) => {
    const label = getOrgTypeDisplayLabel(type) || '—'
    colorByLabel[label] = ORG_TYPE_COLOR_MAP[type?.orgType] || 'dark'
    return label
  })
  const value = labels.length > 0 ? labels : [props.value || '—']

  return (
    <GenericChipRenderer
      {...props}
      value={value}
      renderChip={(chip) =>
        renderOrgTypeChip(chip.text, colorByLabel[chip.text] || 'dark')
      }
      renderOverflowChip={(count) =>
        count > 0 ? renderOrgTypeChip(`+${count}`, 'dark') : null
      }
    />
  )
}

OrgTypeRenderer.filterPillRenderer = ({ rawValue }) => {
  if (!rawValue) return null
  const color = ORG_TYPE_COLOR_MAP[rawValue as string] || 'dark'
  const display =
    getOrgTypeDisplayLabel({ orgType: rawValue as string }) ||
    (rawValue as string)
  return renderOrgTypeBadge(display, color)
}

export const YesNoTextRenderer = (props: RendererProps): ReactElement => (
  <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
    {props.value ? 'Yes' : 'No'}
  </BCBox>
)

export const FuelCodeStatusRenderer = (props: RendererProps): ReactElement => {
  const location = useLocation()
  const statusArr = getAllFuelCodeStatuses()
  const statusColorArr: BCBadgeColor[] = ['info', 'info', 'success', 'error']
  const statusIndex = statusArr.indexOf(props.data?.status)
  return (
    <Link
      to={props.node?.id && location.pathname + '/' + props?.node?.id}
      style={{ color: '#000' }}
    >
      <BCBox sx={{ width: '100%', height: '100%' }}>
        <BCBox
          mt={1}
          sx={{
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <BCBadge
            badgeContent={statusArr[statusIndex]}
            color={statusColorArr[statusIndex]}
            variant="contained"
            size="lg"
            sx={{
              '& .MuiBadge-badge': {
                minWidth: '120px',
                fontWeight: 'regular',
                textTransform: 'capitalize',
                fontSize: '0.875rem',
                padding: '0.4em 0.6em'
              }
            }}
          />
        </BCBox>
      </BCBox>
    </Link>
  )
}

export const FuelCodePrefixRenderer = (
  params: RendererProps
): ReactElement | string => {
  const location = useLocation()
  const prefix = params.data.prefix
  const countryName = params.data.fuelProductionFacilityCountry
  const countryCode = countryName ? getCode(countryName) : null

  if (!countryCode) return prefix

  return (
    <Link
      to={params.node?.id && location.pathname + '/' + params?.node?.id}
      style={{ color: '#000' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <img
          src={`https://flagcdn.com/${countryCode.toLowerCase()}.svg`}
          style={{ width: '1.6rem', height: '1.4rem' }}
          alt={countryName}
        />
        <span>{prefix}</span>
      </div>
    </Link>
  )
}

const TRANSFER_STATUS_TO_COLOR_MAP: Record<string, BCBadgeColor> = {
  [TRANSFER_STATUSES.NEW]: 'info',
  [TRANSFER_STATUSES.DRAFT]: 'info',
  [TRANSFER_STATUSES.SENT]: 'info',
  [TRANSFER_STATUSES.SUBMITTED]: 'info',
  [TRANSFER_STATUSES.RECOMMENDED]: 'info',
  [COMPLIANCE_REPORT_STATUSES.ASSESSED]: 'success',
  [COMPLIANCE_REPORT_STATUSES.EXEMPTED]: 'success',
  [TRANSACTION_STATUSES.APPROVED]: 'success',
  [TRANSFER_STATUSES.RECORDED]: 'success',
  [TRANSFER_STATUSES.REFUSED]: 'error',
  [TRANSFER_STATUSES.DECLINED]: 'error',
  [TRANSFER_STATUSES.RESCINDED]: 'error',
  [TRANSFER_STATUSES.DELETED]: 'error'
}

export const TransactionStatusRenderer: RendererWithFilterPill = (
  props: RendererProps
): ReactElement => {
  const buildBadge = (status: string) => (
    <BCBadge
      badgeContent={status}
      color={TRANSFER_STATUS_TO_COLOR_MAP[status]}
      variant="contained"
      size="lg"
      sx={{
        '& .MuiBadge-badge': {
          minWidth: '120px',
          fontWeight: 'regular',
          fontSize: '0.875rem',
          padding: '0.4em 0.6em'
        }
      }}
    />
  )

  const component = (
    <BCBox
      m={1}
      sx={{
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      {buildBadge(props.data.status)}
    </BCBox>
  )
  if (props.url) {
    const baseUrl = props.isAbsolute ? '' : `${location.pathname}/`
    const targetUrl =
      baseUrl +
      ((props.url && props.url({ data: props.data })) || props?.node?.id)

    return (
      <Link to={targetUrl} style={{ color: '#000' }}>
        {component}
      </Link>
    )
  } else {
    return component
  }
}

TransactionStatusRenderer.filterPillRenderer = ({ rawValue }) => {
  if (!rawValue) return null
  return (
    <BCBadge
      badgeContent={rawValue as string}
      color={TRANSFER_STATUS_TO_COLOR_MAP[rawValue as string]}
      variant="contained"
      size="lg"
      sx={{
        '& .MuiBadge-badge': {
          minWidth: '120px',
          fontWeight: 'regular',
          fontSize: '0.875rem',
          padding: '0.4em 0.6em'
        }
      }}
    />
  )
}

const STATUS_TO_COLOR_MAP: Record<string, BCBadgeColor> = {
  [COMPLIANCE_REPORT_STATUSES.DRAFT]: 'info',
  [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: 'info',
  [COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]: 'info',
  [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: 'info',
  [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: 'info',
  [COMPLIANCE_REPORT_STATUSES.ASSESSED]: 'success',
  [COMPLIANCE_REPORT_STATUSES.EXEMPTED]: 'success',
  [COMPLIANCE_REPORT_STATUSES.SUPPLEMENTAL_REQUESTED]: 'warning',
  [COMPLIANCE_REPORT_STATUSES.REJECTED]: 'error'
}

export const ReportsStatusRenderer: RendererWithFilterPill = (
  props: RendererProps
): ReactElement => {
  return (
    <Link
      to={
        (props.url &&
          location.pathname +
            '/' +
            props.url({ data: props.data })) as unknown as string
      }
      style={{ color: '#000' }}
    >
      <BCBox
        m={1}
        sx={{
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <BCBadge
          badgeContent={props.data.reportStatus.replace(/_/g, ' ')}
          color={STATUS_TO_COLOR_MAP[props.data.reportStatus]}
          variant="contained"
          size="lg"
          sx={{
            '& .MuiBadge-badge': {
              minWidth: '120px',
              fontWeight: 'regular',
              fontSize: '0.875rem',
              padding: '0.4em 0.6em'
            }
          }}
        />
      </BCBox>
    </Link>
  )
}

ReportsStatusRenderer.filterPillRenderer = ({ rawValue }) => {
  if (!rawValue) return null
  const rawString = String(rawValue)
  const displayValue = rawString.replace(/_/g, ' ')
  const color =
    STATUS_TO_COLOR_MAP[rawString] ||
    STATUS_TO_COLOR_MAP[rawString.replace(/ /g, '_')] ||
    'info'

  return (
    <BCBadge
      badgeContent={displayValue}
      color={color}
      variant="contained"
      size="lg"
      sx={{
        '& .MuiBadge-badge': {
          minWidth: '120px',
          fontWeight: 'regular',
          fontSize: '0.875rem',
          padding: '0.4em 0.6em'
        }
      }}
    />
  )
}

export const RoleSpanRenderer = (props: RendererProps): ReactElement => (
  <>
    {props.data.roles
      .filter(
        (r: { name: string }) =>
          r.name !== roles.government && r.name !== roles.supplier
      )
      .map(
        (role: {
          roleId: string | number
          name: string
          isGovernmentRole: boolean
        }) => (
          <BCBadge
            key={role.roleId}
            sx={{
              '& .MuiBadge-badge': {
                fontWeight: 'regular',
                fontSize: '0.9rem',
                padding: '0.4em 0.6em'
              },
              margin: '2px'
            }}
            badgeContent={role.name}
            color={role.isGovernmentRole ? 'primary' : 'secondary'}
            variant="outlined"
            size="md"
          />
        )
      )}
  </>
)

interface GenericChipRendererProps extends RendererProps {
  disableLink?: boolean
  renderChip?: (chip: ChipDescriptor) => ReactNode
  renderOverflowChip?: (hiddenChipsCount: number) => ReactNode
  chipConfig?: ChipConfig
}

const DEFAULT_CHIP_CONFIG: ChipConfig = {}

const GenericChipRenderer = ({
  value,
  disableLink = false,
  renderChip = defaultRenderChip,
  renderOverflowChip = defaultRenderOverflowChip,
  chipConfig = DEFAULT_CHIP_CONFIG,
  ...props
}: GenericChipRendererProps): ReactElement => {
  const location = useLocation()
  const { colDef, api } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [visibleChips, setVisibleChips] = useState<ChipDescriptor[]>([])
  const [hiddenChipsCount, setHiddenChipsCount] = useState(0)

  const options = useMemo<string[]>(() => {
    if (Array.isArray(value)) {
      return value
        .map((item: unknown) => item?.label || item)
        .filter((item: unknown) => item && item !== '')
    }

    if (value?.label) {
      return [value.label]
    }

    if (typeof value === 'string' && value) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }

    return []
  }, [value])

  const calculateChipWidths = useCallback((): {
    visibleChips: ChipDescriptor[]
    hiddenChipsCount: number
  } => {
    if (!containerRef.current) return { visibleChips: [], hiddenChipsCount: 0 }

    const containerWidth = containerRef.current.offsetWidth || 200 // Fallback width
    let totalWidth = 0
    const chipWidths: ChipDescriptor[] = []

    for (let i = 0; i < options.length; i++) {
      const chipText = options[i]
      const chipTextWidth = chipText.length * 6 // Assuming 6px per character
      const newTotalWidth = totalWidth + chipTextWidth + 32 + 20 // Adding 32px for padding and 20px for overflow counter chip

      if (newTotalWidth <= containerWidth) {
        chipWidths.push({
          text: chipText,
          width: chipTextWidth + 32,
          ...chipConfig
        })
        totalWidth = newTotalWidth
      } else {
        return {
          visibleChips: chipWidths,
          hiddenChipsCount: options.length - chipWidths.length
        }
      }
    }

    return {
      visibleChips: options.map((text) => ({
        text,
        width: text.length * 6 + 32,
        ...chipConfig
      })),
      hiddenChipsCount: 0
    }
  }, [options, chipConfig])

  useEffect(() => {
    const { visibleChips, hiddenChipsCount } = calculateChipWidths()
    setVisibleChips(visibleChips)
    setHiddenChipsCount(hiddenChipsCount)

    const resizeObserver = new ResizeObserver(() => {
      const { visibleChips, hiddenChipsCount } = calculateChipWidths()
      setVisibleChips(visibleChips)
      setHiddenChipsCount(hiddenChipsCount)
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    const resizeListener = (event: { column?: { getColId: () => string } }) => {
      const resizedColumn = event.column
      if (resizedColumn && resizedColumn.getColId() === colDef.field) {
        const { visibleChips, hiddenChipsCount } = calculateChipWidths()
        setVisibleChips(visibleChips)
        setHiddenChipsCount(hiddenChipsCount)
      }
    }

    if (api) {
      api.addEventListener('columnResized', resizeListener)

      return () => {
        api.removeEventListener('columnResized', resizeListener)
        resizeObserver.disconnect()
      }
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [value, api, colDef, calculateChipWidths])

  const chipContent = (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        margin: '8px 0px',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}
    >
      {visibleChips.map(renderChip)}
      {renderOverflowChip(hiddenChipsCount)}
    </div>
  )
  const baseUrl = props.isAbsolute ? '' : `${location.pathname}/`
  const targetUrl =
    baseUrl +
    ((props.url && props.url({ data: props.data })) || props?.node?.id)
  return disableLink ? (
    chipContent
  ) : (
    <Link to={targetUrl} style={{ color: '#000' }}>
      {chipContent}
    </Link>
  )
}

const defaultRenderChip = (chip: ChipDescriptor): ReactElement => (
  <span
    key={chip.text}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: '23px',
      padding: '0.5rem',
      backgroundColor: `${colors.input.main}`,
      color: '#fff',
      margin: '0 2px',
      minWidth: `${Math.max(chip.width || 60, 40)}px`,
      maxWidth: `${chip.maxWidth || 200}px`,
      fontSize: '0.8125rem',
      boxSizing: 'border-box',
      height: '32px',
      borderRadius: '16px',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      flexShrink: 0,
      transition: 'all 0.2s ease'
    }}
    title={chip.text}
  >
    {chip.text}
  </span>
)

const defaultRenderOverflowChip = (hiddenChipsCount: number): ReactNode =>
  hiddenChipsCount > 0 && (
    <span
      key="overflow-chip"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        borderRadius: '16px',
        padding: '0.5rem',
        color: `${colors.text.main}`,
        cursor: 'pointer',
        margin: '0 2px',
        fontSize: '0.8125rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minWidth: '40px',
        maxWidth: '60px',
        height: '32px',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid rgba(0, 0, 0, 0.12)',
        transition: 'all 0.2s ease'
      }}
      title={`+${hiddenChipsCount} more`}
    >
      +{hiddenChipsCount}
    </span>
  )

const roleRenderChip = (
  chip: ChipDescriptor,
  isGovernmentRole = false
): ReactElement => (
  <BCBadge
    key={chip.text}
    sx={{
      '& .MuiBadge-badge': {
        fontWeight: 'regular',
        fontSize: '0.9rem',
        padding: '0.4em 0.6em'
      },
      margin: '2px'
    }}
    badgeContent={chip.text}
    color={isGovernmentRole ? 'primary' : 'secondary'}
    variant="outlined"
    size="md"
  />
)

const roleRenderOverflowChip = (
  hiddenChipsCount: number,
  isGovernmentRole = false
): ReactNode =>
  hiddenChipsCount > 0 && (
    <span
      key="overflow-chip"
      style={{
        backgroundColor: isGovernmentRole
          ? 'rgba(0, 51, 102, 0.3)'
          : 'rgba(252, 186, 25, 0.3)',
        borderRadius: '16px',
        padding: '0.5rem',
        color: `${colors.text.main}`,
        cursor: 'text',
        margin: '0 2px',
        fontSize: '0.8125rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: '40px',
        height: '32px',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden'
      }}
      title={`+${hiddenChipsCount} more`}
    >
      +{hiddenChipsCount}
    </span>
  )

export default GenericChipRenderer

export const CommonArrayRenderer = (
  props: GenericChipRendererProps
): ReactElement => (
  <GenericChipRenderer
    {...props}
    renderChip={defaultRenderChip}
    renderOverflowChip={defaultRenderOverflowChip}
  />
)

export const RoleRenderer = (props: RendererProps): ReactElement => {
  const { value } = props
  const [isGovernmentRole, setIsGovernmentRole] = useState(false)

  const filteredRoles: string[] = Array.isArray(value)
    ? value
    : (value as string)
        .split(',')
        .map((role) => role.trim())
        .filter((role) => role !== roles.government && role !== roles.supplier)

  useEffect(() => {
    setIsGovernmentRole((value as string).includes(roles.government))
  }, [value])

  return (
    <GenericChipRenderer
      {...props}
      value={filteredRoles}
      renderChip={(chip) => roleRenderChip(chip, isGovernmentRole)}
      renderOverflowChip={(count) =>
        roleRenderOverflowChip(count, isGovernmentRole)
      }
    />
  )
}

export const LastCommentRenderer = (props: RendererProps): ReactElement => {
  const location = useLocation()
  const { lastComment } = props.data

  if (!lastComment || !lastComment.fullName) {
    return (
      <Link
        to={`${location.pathname}/${props.data.compliancePeriod}/${props.data.complianceReportId}`}
        style={{ color: '#000' }}
      >
        <BCBox component="div" sx={{ width: '100%', height: '100%' }} />
      </Link>
    )
  }

  return (
    <Link
      to={`${location.pathname}/${props.data.compliancePeriod}/${props.data.complianceReportId}`}
      style={{ color: '#000' }}
    >
      <BCBox
        component="div"
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 1
        }}
      >
        <BCUserInitials
          fullName={lastComment.fullName}
          tooltipText={lastComment.comment}
          maxLength={500}
          variant="filled"
          sx={{
            bgcolor: '#606060',
            color: 'white',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            minWidth: '32px',
            '& .MuiChip-label': {
              padding: 0
            },
            '&:hover': {
              bgcolor: '#505050'
            }
          }}
        />
      </BCBox>
    </Link>
  )
}

export const ChargingSiteStatusRenderer = createStatusRenderer(
  {
    Draft: 'info',
    Submitted: 'warning',
    Validated: 'success',
    Updated: 'info',
    Decommissioned: 'error'
  },
  {
    statusField: 'status.status'
  }
)

export const CIApplicationStatusRenderer = createStatusRenderer(
  {
    Draft: 'info',
    Submitted: 'warning',
    'Changes requested': 'warning',
    Approved: 'success',
    Completed: 'success',
    Withdrawn: 'error'
  },
  {
    statusField: 'status.status'
  }
)
