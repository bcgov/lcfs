import BCBadge from '@/components/BCBadge'
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
import { Link, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import colors from '@/themes/base/colors'
import { ArrowDropDown } from '@mui/icons-material'
import { getCode } from 'country-list'

export const TextRenderer = (props) => {
  return (
    <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
      {props.valueFormatted || props.value}
    </BCBox>
  )
}

export const LinkRenderer = (props) => {
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

export const SelectRenderer = (params) => {
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

export const MultiSelectRenderer = (params) => {
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
    return <CommonArrayRenderer disableLink {...params} />
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

export const ConditionalLinkRenderer = (condition) => {
  return (props) => {
    if (condition(props)) {
      return LinkRenderer(props)
    } else {
      return TextRenderer(props)
    }
  }
}

const BaseStatusRenderer = ({
  isView = false,
  value = false,
  successText = 'Active',
  failureText = 'Inactive',
  successColor = 'success',
  failureColor = 'smoky'
}) => {
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

export const StatusRenderer = (props) => (
  <BaseStatusRenderer isView={props.isView} value={props.data.isActive} />
)

export const LoginStatusRenderer = (props) => (
  <BaseStatusRenderer
    isView={props.isView}
    value={props.data.isLoginSuccessful}
    successText="Success"
    failureText="Failed"
    failureColor="error"
  />
)

export const OrgStatusRenderer = (props) => {
  const location = useLocation()
  const statusArr = getAllOrganizationStatuses()
  const statusColorArr = ['info', 'success', 'warning', 'error']
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

export const YesNoTextRenderer = (props) => (
  <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
    {props.value ? 'Yes' : 'No'}
  </BCBox>
)

export const FuelCodeStatusRenderer = (props) => {
  const location = useLocation()
  const statusArr = getAllFuelCodeStatuses()
  const statusColorArr = ['info', 'info', 'success', 'error']
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

export const FuelCodePrefixRenderer = (params) => {
  const location = useLocation()
  const prefix = params.data.prefix
  const countryName = params.data.fuelProductionFacilityCountry
  const countryCode = countryName ? getCode(countryName) : null

  if (!countryCode) return prefix

  // Use country flags API
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

const TRANSFER_STATUS_TO_COLOR_MAP = {
  [TRANSFER_STATUSES.NEW]: 'info',
  [TRANSFER_STATUSES.DRAFT]: 'info',
  [TRANSFER_STATUSES.SENT]: 'info',
  [TRANSFER_STATUSES.SUBMITTED]: 'info',
  [TRANSFER_STATUSES.RECOMMENDED]: 'info',
  [COMPLIANCE_REPORT_STATUSES.ASSESSED]: 'success',
  [TRANSACTION_STATUSES.APPROVED]: 'success',
  [TRANSFER_STATUSES.RECORDED]: 'success',
  [TRANSFER_STATUSES.REFUSED]: 'error',
  [TRANSFER_STATUSES.DECLINED]: 'error',
  [TRANSFER_STATUSES.RESCINDED]: 'error',
  [TRANSFER_STATUSES.DELETED]: 'error'
}

export const TransactionStatusRenderer = (props) => {
  const component = (
    <BCBox
      m={1}
      sx={{
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <BCBadge
        badgeContent={props.data.status}
        color={TRANSFER_STATUS_TO_COLOR_MAP[props.data.status]}
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

const STATUS_TO_COLOR_MAP = {
  [COMPLIANCE_REPORT_STATUSES.DRAFT]: 'info',
  [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: 'info',
  [COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]: 'info',
  [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: 'info',
  [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: 'info',
  [COMPLIANCE_REPORT_STATUSES.ASSESSED]: 'success',
  [COMPLIANCE_REPORT_STATUSES.SUPPLEMENTAL_REQUESTED]: 'warning',
  [COMPLIANCE_REPORT_STATUSES.REJECTED]: 'error'
}

export const ReportsStatusRenderer = (props) => {
  return (
    <Link
      to={
        props.url && location.pathname + '/' + props.url({ data: props.data })
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
          badgeContent={props.data.reportStatus.replaceAll('_', ' ')}
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

export const RoleSpanRenderer = (props) => (
  <>
    {props.data.roles
      .filter((r) => r.name !== roles.government && r.name !== roles.supplier)
      .map((role) => (
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
      ))}
  </>
)

const GenericChipRenderer = ({
  value,
  disableLink = false,
  renderChip = defaultRenderChip,
  renderOverflowChip = defaultRenderOverflowChip,
  chipConfig = {},
  ...props
}) => {
  const location = useLocation()
  const { colDef, api } = props
  const containerRef = useRef(null)
  const [visibleChips, setVisibleChips] = useState([])
  const [hiddenChipsCount, setHiddenChipsCount] = useState(0)

  const options = useMemo(
    () =>
      Array.isArray(value)
        ? value.filter((item) => item !== '')
        : value && value !== ''
          ? value
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item !== '')
          : [],
    [value]
  )

  const calculateChipWidths = useCallback(() => {
    if (!containerRef.current) return { visibleChips: [], hiddenChipsCount: 0 }

    const containerWidth = containerRef.current.offsetWidth || 200 // Fallback width
    let totalWidth = 0
    const chipWidths = []

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
  }, [options])

  // Initial render and resize handling
  useEffect(() => {
    // Calculate and set chips on initial render
    const { visibleChips, hiddenChipsCount } = calculateChipWidths()
    setVisibleChips(visibleChips)
    setHiddenChipsCount(hiddenChipsCount)

    // Resize listener
    const resizeObserver = new ResizeObserver(() => {
      const { visibleChips, hiddenChipsCount } = calculateChipWidths()
      setVisibleChips(visibleChips)
      setHiddenChipsCount(hiddenChipsCount)
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Column resize listener for ag-Grid
    const resizeListener = (event) => {
      const resizedColumn = event.column
      if (resizedColumn && resizedColumn.getColId() === colDef.field) {
        const { visibleChips, hiddenChipsCount } = calculateChipWidths()
        setVisibleChips(visibleChips)
        setHiddenChipsCount(hiddenChipsCount)
      }
    }

    if (api) {
      api.addEventListener('columnResized', resizeListener)

      // Cleanup
      return () => {
        api.removeEventListener('columnResized', resizeListener)
        resizeObserver.disconnect()
      }
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [value, api, colDef])

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

// Default Render Chip Function for CommonArrayRenderer
const defaultRenderChip = (chip) => (
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
      width: `${chip.width}px`,
      fontSize: '0.8125rem',
      boxSizing: 'border-box',
      height: '32px',
      borderRadius: '16px',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      overflow: 'hidden'
    }}
  >
    {chip.text}
  </span>
)

// Default Overflow Chip for CommonArrayRenderer
const defaultRenderOverflowChip = (hiddenChipsCount) =>
  hiddenChipsCount > 0 && (
    <span
      key="overflow-chip"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
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

// Role Specific Render Chip Function
const roleRenderChip = (chip, isGovernmentRole = false) => (
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

// Role Specific Overflow Chip
const roleRenderOverflowChip = (hiddenChipsCount, isGovernmentRole = false) =>
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

export const CommonArrayRenderer = (props) => (
  <GenericChipRenderer
    {...props}
    renderChip={defaultRenderChip}
    renderOverflowChip={defaultRenderOverflowChip}
  />
)

export const RoleRenderer = (props) => {
  const { value } = props
  const [isGovernmentRole, setIsGovernmentRole] = useState(false)

  const filteredRoles = Array.isArray(value)
    ? value
    : value
        .split(',')
        .map((role) => role.trim())
        .filter((role) => role !== roles.government && role !== roles.supplier)

  useEffect(() => {
    setIsGovernmentRole(value.includes(roles.government))
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

export const LastCommentRenderer = (props) => {
  const location = useLocation()
  const { lastComment } = props.data

  // If no comment exists, return empty cell
  if (!lastComment || !lastComment.fullName) {
    return (
      <Link
        to={`${location.pathname}/${props.data.compliancePeriod}/${props.data.complianceReportId}`}
        style={{ color: '#000' }}
      >
        <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
          {/* Empty cell but still clickable */}
        </BCBox>
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
