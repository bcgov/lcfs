/* eslint-disable react-hooks/exhaustive-deps */
import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { roles } from '@/constants/roles'
import {
  getAllFuelCodeStatuses,
  getAllOrganizationStatuses
} from '@/constants/statuses'
import { Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import colors from '@/themes/base/colors'

export const TextRenderer = (props) => {
  return (
    <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
      {props.valueFormatted || props.value}
    </BCBox>
  )
}

export const LinkRenderer = (props) => {
  const location = useLocation()
  return (
    <Link
      to={
        location.pathname +
        '/' +
        ((props.url && props.url({ data: props.data })) || props?.node?.id)
      }
      style={{ color: '#000' }}
    >
      <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
        {props.valueFormatted || props.value}
      </BCBox>
    </Link>
  )
}

export const StatusRenderer = (props) => {
  return (
    <BCBox
      component={props.isView ? 'span' : 'div'}
      mt={1}
      sx={{ width: '100%', height: '100%' }}
    >
      <BCBadge
        badgeContent={props.data.isActive ? 'Active' : 'Inactive'}
        color={props.data.isActive ? 'success' : 'smoky'}
        variant="gradient"
        size="md"
        sx={{
          ...(!props.isView
            ? { display: 'flex', justifyContent: 'center' }
            : {}),
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
  )
}

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
export const FuelCodeStatusRenderer = (props) => {
  const location = useLocation()
  const statusArr = getAllFuelCodeStatuses()
  const statusColorArr = ['info', 'success', 'error']
  const statusIndex = statusArr.indexOf(props.data.fuelCodeStatus.status)
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
export const FuelCodeStatusTextRenderer = (props) => {
  const statusArr = getAllFuelCodeStatuses()
  const statusColorArr = ['info', 'success', 'error']
  const statusIndex = statusArr.indexOf(props.data.fuelCodeStatus.status)
  return (
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
  )
}

export const TransactionStatusRenderer = (props) => {
  const statusArr = [
    'Draft',
    'Recommended',
    'Sent',
    'Submitted',
    'Approved',
    'Recorded',
    'Refused',
    'Deleted',
    'Declined',
    'Rescinded'
  ]
  const statusColorArr = [
    'info',
    'info',
    'info',
    'info',
    'success',
    'success',
    'error',
    'error',
    'error',
    'error'
  ]
  const statusIndex = statusArr.indexOf(props.data.status)
  return (
    <BCBox
      m={1}
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
            fontSize: '0.875rem',
            padding: '0.4em 0.6em'
          }
        }}
      />
    </BCBox>
  )
}
export const ReportsStatusRenderer = (props) => {
  const statusArr = [
    'Draft',
    'Submitted',
    'Recommended by analyst',
    'Recommended by manager',
    'Assessed',
    'RecoReassessedrded'
  ]
  const statusColorArr = ['info', 'info', 'info', 'info', 'success', 'success']
  const statusIndex = statusArr.indexOf(props.data.currentStatus.status)
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
          badgeContent={statusArr[statusIndex]}
          color={statusColorArr[statusIndex]}
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

  const options = Array.isArray(value)
    ? value
    : value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

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
      if (resizedColumn.getColId() === colDef.field) {
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

  return disableLink ? (
    chipContent
  ) : (
    <a
      href={`${location.pathname}?filter=${options.join(',')}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {chipContent}
    </a>
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
    setIsGovernmentRole(
      Array.isArray(value)
        ? value.includes(roles.government)
        : value.includes(roles.government)
    )
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
