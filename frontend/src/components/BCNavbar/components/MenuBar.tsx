import BCBox from '@/components/BCBox'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import { Divider, Toolbar } from '@mui/material'
import React from 'react'
import type {
  NavbarRoute,
  NavbarContextData
} from '@/components/BCNavbar/types'

interface MenuBarProps {
  routes: NavbarRoute[]
  data: NavbarContextData
}

const MenuBar = ({ routes, data }: MenuBarProps) => {
  return (
    <Toolbar
      className="nav"
      sx={(theme: any) => {
        const { secondary, white } = theme.palette
        const { rgba } = theme.functions
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
      <BCBox
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'row',
          margin: 0,
          padding: 0,
          marginLeft: 1
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
      >
        {data.menuRightPart &&
          React.cloneElement(data.menuRightPart, { data })}
      </BCBox>
    </Toolbar>
  )
}

export default MenuBar
