import { useState, forwardRef, type ReactNode, type Ref } from 'react'
import { NavLink } from 'react-router-dom'
import Icon from '@mui/material/Icon'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import type { Theme } from '@mui/material/styles'

interface DefaultNavbarLinkProps {
  icon?: ReactNode | string
  name: string
  route: string
  light?: boolean
  onClick?: () => void
  isMobileView?: boolean
  sx?: Record<string, unknown>
}

const DefaultNavbarLink = forwardRef<HTMLAnchorElement, DefaultNavbarLinkProps>(
  (
    {
      icon,
      name,
      route,
      light = false,
      onClick,
      isMobileView = false,
      sx = {}
    },
    ref
  ) => {
    const [hover, setHover] = useState(false)
    return (
      <BCBox
        component={NavLink}
        className="NavLink"
        to={route}
        mx={1}
        mt={-0.1}
        mb={isMobileView ? 0.2 : -1}
        mr={isMobileView ? 2 : 1}
        py={1}
        px={1}
        display="flex"
        alignItems="center"
        ref={ref as Ref<HTMLDivElement>}
        sx={(theme: Theme) => {
          const { transitions } = theme
          return {
            cursor: 'pointer',
            userSelect: 'none',
            minHeight: '2.7rem',
            paddingBottom: isMobileView ? '10px' : '15px',
            '&:hover': {
              borderBottom: isMobileView ? '0' : '6px solid #38598a',
              backgroundColor: hover
                ? isMobileView
                  ? 'rgba(0, 0, 0, 0.1)'
                  : 'rgba(0, 0, 0, 0.2)'
                : 'transparent',
              paddingBottom: isMobileView ? '10px' : '9px'
            },
            '&.active': {
              borderBottom: isMobileView ? '0' : '3px solid #fcc219',
              borderLeft: isMobileView ? '3px solid #fcc219' : '0',
              backgroundColor: isMobileView
                ? 'rgba(0, 0, 0, 0.2)'
                : 'rgba(0, 0, 0, 0.3)',
              paddingBottom: isMobileView ? '11px' : '12px'
            },
            transform: 'translateX(0)',
            transition: transitions.create('transform', {
              easing: transitions.easing.sharp,
              duration: transitions.duration.shorter
            }),
            ...sx
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
      >
        {icon && typeof icon === 'string' ? (
          <Icon
            sx={{
              color: '#fff',
              verticalAlign: 'middle'
            }}
          >
            {icon}
          </Icon>
        ) : (
          icon
        )}
        <BCTypography
          variant="body2"
          fontWeight="light"
          color={light ? 'primary' : 'white'}
          sx={{
            width: '100%',
            lineHeight: 0,
            '&:hover': {
              textDecoration: 'none'
            },
            whiteSpace: 'nowrap',
            flexShrink: 0,
            ml: icon ? 0.5 : 0
          }}
        >
          {name}
        </BCTypography>
      </BCBox>
    )
  }
)

DefaultNavbarLink.displayName = 'DefaultNavbarLink'

export default DefaultNavbarLink
