import React from 'react'
import { Outlet, useMatches } from 'react-router-dom'
import { Container, Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import Footer from '@/components/Footer'
import { PublicHeader } from './components/PublicHeader'
import { PublicBreadcrumb } from './components/PublicBreadcrumb'

export const PublicPageLayout = () => {
  const matches = useMatches()
  const pageTitle = matches[matches.length - 1]?.handle?.title || 'LCFS'

  return (
    <BCBox display="flex" flexDirection="column" minHeight="100vh">
      <BCTypography variant="h1" className="visually-hidden">
        {pageTitle}
      </BCTypography>

      <PublicHeader />

      <Container
        maxWidth="lg"
        sx={{
          marginTop: '1px',
          paddingX: '40px',
          flexGrow: 1,
          '@media (max-width: 920px)': {
            marginTop: '2rem'
          }
        }}
        disableGutters
      >
        <Stack container spacing={2}>
          <BCBox size={12}>
            <PublicBreadcrumb />
          </BCBox>
          <BCBox
            elevation={5}
            sx={{
              padding: '.75rem 0rem',
              minHeight: 'auto'
            }}
          >
            <Outlet />
          </BCBox>
        </Stack>
      </Container>

      <Footer />
    </BCBox>
  )
}
