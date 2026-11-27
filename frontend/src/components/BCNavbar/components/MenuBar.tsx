import BCBox from '@/components/BCBox'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import Divider from '@mui/material/Divider'
import Toolbar from '@mui/material/Toolbar'
import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type {
  NavbarRoute,
  NavbarContextData
} from '@/components/BCNavbar/types'
import type { Theme } from '@mui/material/styles'

type NavbarTheme = Theme & {
  functions: { rgba: (color: string, opacity: number) => string }
  palette: Theme['palette'] & {
    white: { main: string }
    secondary: Theme['palette']['secondary'] & { nav: string }
  }
}

interface MenuBarProps {
  routes: NavbarRoute[]
  data: NavbarContextData
}

// Fades whichever edges of the tabs are cut off, so the strip looks
// scrollable. At the right edge the last 16px stay clear, leaving a gap
// before the user's name. It's a mask, not a margin: changing the layout
// here could keep the tabs cut off after they fit again.
const edgeFade = (start: boolean, end: boolean) => {
  if (!start && !end) return 'none'
  const left = start ? 'transparent 0px, #000 32px' : '#000 0px'
  const right = end
    ? '#000 calc(100% - 48px), transparent calc(100% - 16px)'
    : '#000 100%'
  return `linear-gradient(to right, ${left}, ${right})`
}

const MenuBar = ({ routes, data }: MenuBarProps) => {
  const tabsRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const [clipped, setClipped] = useState({ start: false, end: false })

  // Track which edges of the tabs are cut off as the window resizes or the
  // tabs scroll.
  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const start = tabs.scrollLeft > 0
      const end = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 1
      setClipped((current) =>
        current.start === start && current.end === end
          ? current
          : { start, end }
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(tabs)
    for (const child of Array.from(tabs.children)) observer.observe(child)
    tabs.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      tabs.removeEventListener('scroll', update)
    }
  }, [routes])

  // When the tabs scroll sideways, keep the current page's tab in view.
  useEffect(() => {
    const tabs = tabsRef.current
    const active = tabs?.querySelector<HTMLElement>('.NavLink.active')
    if (!tabs || !active) return
    const right = active.offsetLeft + active.offsetWidth
    if (active.offsetLeft < tabs.scrollLeft) {
      tabs.scrollLeft = active.offsetLeft
    } else if (right > tabs.scrollLeft + tabs.clientWidth) {
      tabs.scrollLeft = right - tabs.clientWidth
    }
  }, [pathname])

  return (
    <Toolbar
      className="nav"
      sx={(theme) => {
        const navbarTheme = theme as NavbarTheme
        const { secondary, white } = navbarTheme.palette
        const { rgba } = navbarTheme.functions
        return {
          backgroundColor: rgba(secondary.nav, 1),
          backdropFilter: `saturate(200%) blur(30px)`,
          color: white.main,
          maxHeight: '50px',
          display: { xs: 'none', sm: 'flex' },
          justifyContent: 'space-between'
        }
      }}
      disableGutters
      variant="dense"
    >
      {/* When the tabs don't fit beside the user's actions, they scroll
          sideways here instead of pushing Logout off the page. */}
      <BCBox
        ref={tabsRef}
        data-test="navbar-tabs"
        data-clipped={
          [clipped.start && 'start', clipped.end && 'end']
            .filter(Boolean)
            .join(' ') || undefined
        }
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'row',
          margin: 0,
          padding: 0,
          marginLeft: 1,
          // The tabs hang 8px below this box (their margin-bottom is -8px) so
          // the active underline sits on the bar's edge, and 1px above it.
          // Padding keeps them inside the scroll area; the margins cancel it.
          paddingTop: '1px',
          marginTop: '-1px',
          paddingBottom: 1,
          marginBottom: -1,
          position: 'relative',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          maskImage: edgeFade(clipped.start, clipped.end)
        }}
      >
        {routes.map(
          (route, index) =>
            !route.hide && (
              <React.Fragment key={route.name}>
                <DefaultNavbarLink
                  icon={route.icon}
                  name={route.name}
                  route={route.route}
                  activePaths={route.activePaths}
                  light={false}
                />
                {index !== routes.length - 1 && (
                  <Divider
                    orientation="vertical"
                    variant="middle"
                    flexItem
                    sx={({ palette: { secondary } }) => ({
                      backgroundColor: secondary.main
                    })}
                  />
                )}
              </React.Fragment>
            )
        )}
      </BCBox>
      <div className="animation start-home"></div>
      <BCBox
        display={{ xs: 'none', xl: 'flex' }}
        m={0}
        py={1}
        flexDirection="row"
        flexShrink={0}
      >
        {data.menuRightPart && React.cloneElement(data.menuRightPart, { data })}
      </BCBox>
    </Toolbar>
  )
}

export default MenuBar
