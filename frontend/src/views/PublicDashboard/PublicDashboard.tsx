import { useMemo } from 'react'
import { Box, Button } from '@mui/material'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ReactECharts from 'echarts-for-react'
import { useKeycloak } from '@react-keycloak/web'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/routes/routes'
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import { CONFIG } from '@/constants/config'
import { apiRoutes } from '@/constants/routes'
import { useCreditMarketPublicOverview } from '@/hooks/useCreditMarket'
import { useActiveLoginBgImage } from '@/hooks/useLoginBgImage'
import bgFallbackImage from '@/assets/images/backgrounds/summer.webp'

// BC Government brand palette
const NAVY = '#003366'
const GOLD = '#FCBA19'
const LINK = '#1A5A96'
const DARK = '#313132'
const MUTED = '#565656'
const PRICE_LINE = '#003366'
const BAND_FILL = 'rgba(56,89,138,0.12)'
const VOLUME_FILL = 'rgba(252,186,25,0.7)'

const LEGISLATION_URL =
  'https://www2.gov.bc.ca/gov/content/industry/electricity-alternative-energy/transportation-energies/renewable-low-carbon-fuels'
const REQUIREMENTS_URL =
  'https://www2.gov.bc.ca/gov/content/industry/electricity-alternative-energy/transportation-energies/renewable-low-carbon-fuels/requirements'

const compactFmt = new Intl.NumberFormat('en-CA', {
  notation: 'compact',
  maximumFractionDigits: 1
})
const currencyFmt = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0
})
const intFmt = new Intl.NumberFormat('en-CA')
const priceFmt = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

// Break a section out of the constrained page container to full viewport width.
const fullBleed = {
  position: 'relative',
  width: '100vw',
  left: '50%',
  right: '50%',
  ml: '-50vw',
  mr: '-50vw'
}
const innerContainer = { maxWidth: 1320, mx: 'auto', px: { xs: 3, md: 6 } }

export const PublicDashboard = () => {
  const { t } = useTranslation()
  const { keycloak } = useKeycloak()
  const { data } = useCreditMarketPublicOverview('quarter')
  const { data: activeBg } = useActiveLoginBgImage()

  const priceIndex = data?.priceIndex ?? []
  const periods = priceIndex.map((p) => p.period)

  const bgUrl = activeBg?.loginBgImageId
    ? `${CONFIG.API_BASE}${apiRoutes.loginBgImageStream.replace(
        ':imageId',
        activeBg.loginBgImageId
      )}`
    : bgFallbackImage
  const credits = activeBg
    ? [activeBg.displayName, activeBg.caption].filter(Boolean).join(' — ')
    : null

  const login = (idpHint) =>
    keycloak.login({ idpHint, redirectUri: window.location.origin })

  // Latest VWAP and quarter-over-quarter change for the snapshot card.
  const { latestVwap, latestPeriod, deltaPct } = useMemo(() => {
    const pts = priceIndex.filter((p) => p.vwap != null)
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    return {
      latestVwap: last?.vwap ?? null,
      latestPeriod: last?.period ?? '',
      deltaPct:
        last && prev && prev.vwap
          ? ((last.vwap - prev.vwap) / prev.vwap) * 100
          : null
    }
  }, [priceIndex])
  const deltaDown = deltaPct != null && deltaPct < 0

  const heroStats = [
    {
      key: 'creditsTraded',
      label: t('publicDashboard.stats.creditsTraded'),
      value:
        data?.totalVolumeTraded != null
          ? compactFmt.format(data.totalVolumeTraded)
          : '—'
    },
    {
      key: 'outstandingCredits',
      label: t('publicDashboard.stats.outstandingCredits'),
      value:
        data?.outstandingCredits != null
          ? compactFmt.format(data.outstandingCredits)
          : '—'
    },
    {
      key: 'participatingOrgs',
      label: t('publicDashboard.stats.participatingOrgs'),
      value:
        data?.participatingOrganizations != null
          ? intFmt.format(data.participatingOrganizations)
          : '—'
    }
  ]

  const marketOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          if (!params || !params.length) return ''
          const priceName = t('publicDashboard.market.priceSeries')
          const volName = t('publicDashboard.market.volumeSeries')
          const lines = params
            .filter(
              (p) => p.seriesName === priceName || p.seriesName === volName
            )
            .map((p) => {
              const value =
                p.value == null
                  ? '—'
                  : p.seriesName === priceName
                    ? priceFmt.format(p.value)
                    : intFmt.format(Math.round(p.value))
              return `${p.marker}${p.seriesName}: ${value}`
            })
            .join('<br/>')
          return `${params[0].axisValue}<br/>${lines}`
        }
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '8%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: periods,
        axisLabel: { color: '#767676', fontSize: 10 }
      },
      yAxis: [
        {
          type: 'value',
          scale: true,
          axisLabel: { color: '#767676', fontSize: 10 },
          splitLine: { lineStyle: { color: '#ECECEC' } }
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { show: false }
        }
      ],
      series: [
        {
          name: 'low',
          type: 'line',
          stack: 'band',
          symbol: 'none',
          lineStyle: { opacity: 0 },
          data: priceIndex.map((p) => p.low),
          tooltip: { show: false },
          silent: true
        },
        {
          name: t('publicDashboard.market.rangeSeries'),
          type: 'line',
          stack: 'band',
          symbol: 'none',
          lineStyle: { opacity: 0 },
          areaStyle: { color: BAND_FILL },
          data: priceIndex.map((p) =>
            p.high != null && p.low != null ? p.high - p.low : null
          ),
          tooltip: { show: false },
          silent: true
        },
        {
          name: t('publicDashboard.market.priceSeries'),
          type: 'line',
          smooth: false,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: PRICE_LINE },
          itemStyle: { color: '#fff', borderColor: PRICE_LINE, borderWidth: 2 },
          connectNulls: true,
          data: priceIndex.map((p) => p.vwap)
        },
        {
          name: t('publicDashboard.market.volumeSeries'),
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 22,
          itemStyle: { color: VOLUME_FILL },
          data: priceIndex.map((p) => p.volume)
        }
      ]
    }),
    [priceIndex, periods, t]
  )

  const tools = [
    {
      key: 'calculator',
      icon: <CalculateOutlinedIcon sx={{ fontSize: 30, color: NAVY }} />,
      title: t('publicDashboard.links.calculator'),
      description: t('publicDashboard.tools.calculatorDesc'),
      route: ROUTES.CREDIT_CALCULATOR
    },
    {
      key: 'calculationData',
      icon: <TableChartOutlinedIcon sx={{ fontSize: 30, color: NAVY }} />,
      title: t('publicDashboard.links.calculationData'),
      description: t('publicDashboard.tools.calculationDataDesc'),
      route: ROUTES.CALCULATION_DATA
    },
    {
      key: 'approvedCarbonIntensities',
      icon: <VerifiedOutlinedIcon sx={{ fontSize: 30, color: NAVY }} />,
      title: t('publicDashboard.links.approvedCarbonIntensities'),
      description: t('publicDashboard.tools.approvedCarbonIntensitiesDesc'),
      route: ROUTES.APPROVED_CARBON_INTENSITIES
    },
    {
      key: 'releaseNotes',
      icon: <DescriptionOutlinedIcon sx={{ fontSize: 30, color: NAVY }} />,
      title: t('publicDashboard.links.releaseNotes'),
      description: t('publicDashboard.tools.releaseNotesDesc', {
        defaultValue: 'Recent updates and change history.'
      }),
      route: ROUTES.RELEASE_NOTES
    }
  ]

  const renderLoginButtons = () => (
    <BCBox sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      <Button
        disableElevation
        data-test="public-login-bceid"
        onClick={() => login(IDENTITY_PROVIDERS.BCEID_BUSINESS)}
        sx={{
          backgroundColor: GOLD,
          color: DARK,
          fontWeight: 700,
          fontSize: 15,
          textTransform: 'none',
          px: 3.5,
          py: 1.25,
          borderRadius: '4px',
          '&:hover': { backgroundColor: '#e0a512' }
        }}
      >
        {t('publicDashboard.login.bceid')}
      </Button>
      <Button
        disableElevation
        data-test="public-login-idir"
        onClick={() => login(IDENTITY_PROVIDERS.IDIR)}
        sx={{
          backgroundColor: 'transparent',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          textTransform: 'none',
          px: 3.5,
          py: 1.25,
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,.75)',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(255,255,255,.75)'
          }
        }}
      >
        {t('publicDashboard.login.idir')}
      </Button>
    </BCBox>
  )

  return (
    <BCBox
      data-test="public-dashboard"
      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
    >
      {/* Immersive hero */}
      <BCBox
        data-test="public-hero"
        sx={{
          ...fullBleed,
          backgroundColor: '#0d2b45',
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <BCBox
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(100deg, rgba(0,26,51,.80) 0%, rgba(0,26,51,.52) 45%, rgba(0,26,51,.15) 100%)'
          }}
        />
        <BCBox
          sx={{
            ...innerContainer,
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr minmax(0, 520px)' },
            gap: { xs: 4, md: 7 },
            alignItems: 'center',
            py: { xs: 6, md: 12 }
          }}
        >
          <BCBox>
            <BCTypography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '.14em',
                color: GOLD,
                textTransform: 'uppercase',
                mb: 1.75
              }}
            >
              {t('publicDashboard.cardTitle')}
            </BCTypography>
            <BCTypography
              variant="h1"
              sx={{
                fontSize: { xs: 32, md: 44 },
                lineHeight: 1.12,
                color: '#fff',
                fontWeight: 700,
                mb: 2
              }}
            >
              {t('publicDashboard.hero.title')}
            </BCTypography>
            <BCTypography
              sx={{
                fontSize: 17,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,.88)',
                maxWidth: 520,
                mb: 3.5
              }}
            >
              {t('publicDashboard.hero.subtitle')}
            </BCTypography>

            <BCBox sx={{ mb: 4.5 }}>{renderLoginButtons()}</BCBox>

            <BCBox sx={{ display: 'flex' }}>
              {heroStats.map((s, i) => (
                <BCBox
                  key={s.key}
                  data-test={`hero-stat-${s.key}`}
                  sx={{
                    px: i === 0 ? 0 : 3.5,
                    pr: i === heroStats.length - 1 ? 0 : 3.5,
                    borderRight:
                      i === heroStats.length - 1
                        ? 'none'
                        : '1px solid rgba(255,255,255,.25)'
                  }}
                >
                  <BCTypography
                    sx={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: '#fff',
                      lineHeight: 1.1
                    }}
                  >
                    {s.value}
                  </BCTypography>
                  <BCTypography
                    sx={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)' }}
                  >
                    {s.label}
                  </BCTypography>
                </BCBox>
              ))}
            </BCBox>
          </BCBox>

          {/* Snapshot chart card */}
          <BCBox
            sx={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 12px 36px rgba(0,13,26,.4)',
              p: '24px 26px 20px'
            }}
          >
            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 0.75
              }}
            >
              <BCTypography sx={{ fontSize: 14, fontWeight: 700, color: DARK }}>
                {t('publicDashboard.market.title')}
              </BCTypography>
              <BCTypography
                sx={{
                  fontSize: 11,
                  color: LINK,
                  border: '1px solid #B7CCE0',
                  borderRadius: '99px',
                  px: 1.1,
                  py: 0.25,
                  background: '#F4F8FB'
                }}
              >
                {t('publicDashboard.market.aggregatedNote')}
              </BCTypography>
            </BCBox>

            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1.5,
                mb: 1,
                flexWrap: 'wrap'
              }}
            >
              <BCTypography
                sx={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: NAVY,
                  lineHeight: 1
                }}
              >
                {latestVwap != null ? currencyFmt.format(latestVwap) : '—'}
              </BCTypography>
              <BCTypography sx={{ fontSize: 13, color: MUTED }}>
                {t('publicDashboard.market.avgPriceCaption', {
                  period: latestPeriod
                })}
              </BCTypography>
              {deltaPct != null && (
                <BCTypography
                  sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: deltaDown ? '#A12622' : '#2E7D32',
                    background: deltaDown ? '#F7E6E5' : '#E7F3E8',
                    borderRadius: '4px',
                    px: 1,
                    py: 0.4
                  }}
                >
                  {deltaDown ? '▾' : '▲'} {Math.abs(deltaPct).toFixed(1)}%
                </BCTypography>
              )}
            </BCBox>

            {priceIndex.length > 0 ? (
              <ReactECharts
                option={marketOption}
                style={{ height: 230, width: '100%' }}
              />
            ) : (
              <BCTypography sx={{ fontSize: 13, color: MUTED, py: 4 }}>
                {t('publicDashboard.market.noData')}
              </BCTypography>
            )}

            <BCBox
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 1.5,
                borderTop: '1px solid #ECECEC',
                pt: 1.5,
                gap: 1.5,
                flexWrap: 'wrap'
              }}
            >
              <BCBox
                sx={{
                  display: 'flex',
                  gap: 2,
                  fontSize: 11.5,
                  color: MUTED,
                  alignItems: 'center'
                }}
              >
                <BCBox
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <BCBox
                    sx={{
                      width: 16,
                      borderTop: `2px solid ${NAVY}`,
                      display: 'inline-block'
                    }}
                  />
                  {t('publicDashboard.market.priceSeries')}
                </BCBox>
                <BCBox
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <BCBox
                    sx={{
                      width: 11,
                      height: 11,
                      background: GOLD,
                      opacity: 0.75,
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}
                  />
                  {t('publicDashboard.market.volumeSeries')}
                </BCBox>
              </BCBox>
              <Box
                component={Link}
                to={ROUTES.PUBLIC_MARKET_DATA}
                data-test="explore-market-data"
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: LINK,
                  textDecoration: 'none',
                  '&:hover': { color: NAVY }
                }}
              >
                {t('publicDashboard.market.explore')} →
              </Box>
            </BCBox>
          </BCBox>
        </BCBox>

        {credits && (
          <BCBox sx={{ position: 'absolute', right: 14, bottom: 8 }}>
            <BCTypography sx={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>
              {credits}
            </BCTypography>
          </BCBox>
        )}
      </BCBox>

      {/* Intro + public tools + legislation */}
      <BCBox sx={{ ...fullBleed }}>
        <BCBox sx={{ ...innerContainer, py: { xs: 4, md: 4.5 } }}>
          {/* About the program + using this site */}
          <BCBox
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: { xs: 3, md: 5 },
              mb: 4
            }}
          >
            <BCBox
              sx={{
                background: '#fff',
                border: '1px solid #D8D8D8',
                borderRadius: '8px',
                p: { xs: 2.5, md: 3 },
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                height: '100%'
              }}
            >
              <BCTypography
                variant="h2"
                sx={{ fontSize: 22, fontWeight: 700, color: DARK, mb: 1 }}
              >
                {t('publicDashboard.intro.programTitle', {
                  defaultValue: 'About the Low Carbon Fuel Standard'
                })}
              </BCTypography>
              <BCTypography
                sx={{ fontSize: 16, color: MUTED, lineHeight: 1.6 }}
              >
                {t('publicDashboard.intro.programBody', {
                  defaultValue:
                    "The Low Carbon Fuels Act and its two regulations form British Columbia's Low Carbon Fuel Standard, which sets requirements that encourage the use of renewable and low carbon fuels and offers incentives to organizations that supply them, based on how much these fuels reduce greenhouse gas emissions compared to conventional fuels."
                })}
              </BCTypography>
            </BCBox>
            <BCBox
              sx={{
                background: '#fff',
                border: '1px solid #D8D8D8',
                borderRadius: '8px',
                p: { xs: 2.5, md: 3 },
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                height: '100%'
              }}
            >
              <BCTypography
                variant="h2"
                sx={{ fontSize: 22, fontWeight: 700, color: DARK, mb: 1 }}
              >
                {t('publicDashboard.intro.siteTitle', {
                  defaultValue: 'Using this site'
                })}
              </BCTypography>
              <BCTypography
                sx={{ fontSize: 16, color: MUTED, lineHeight: 1.6 }}
              >
                {t('publicDashboard.intro.siteBody', {
                  defaultValue:
                    'This site provides public access to program tools and data — including the compliance unit calculator, approved carbon intensities, and credit market information. Registered fuel suppliers and government staff can log in to file and review compliance reports.'
                })}
              </BCTypography>
            </BCBox>
          </BCBox>

          <BCTypography
            variant="h2"
            sx={{ fontSize: 22, fontWeight: 700, color: DARK, mb: 0.75 }}
          >
            {t('publicDashboard.toolsTitle')}
          </BCTypography>
          <BCTypography sx={{ fontSize: 14.5, color: MUTED, mb: 2.25 }}>
            {t('publicDashboard.toolsSubtitle')}
          </BCTypography>
          <BCBox sx={{ borderTop: '1px solid #D8D8D8' }}>
            {tools.map((tool) => (
              <Box
                key={tool.key}
                component={Link}
                to={tool.route}
                data-test={`tool-${tool.key}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '40px 1fr 20px',
                    md: '44px 260px 1fr 20px'
                  },
                  gap: 2.5,
                  alignItems: 'center',
                  px: 1,
                  py: 2.25,
                  borderBottom: '1px solid #D8D8D8',
                  textDecoration: 'none',
                  '&:hover': { backgroundColor: '#F2F7FC' }
                }}
              >
                <BCBox sx={{ display: 'flex' }}>{tool.icon}</BCBox>
                <BCTypography
                  sx={{
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: LINK,
                    textDecoration: 'underline'
                  }}
                >
                  {tool.title}
                </BCTypography>
                <BCTypography
                  sx={{
                    fontSize: 14.5,
                    color: MUTED,
                    display: { xs: 'none', md: 'block' }
                  }}
                >
                  {tool.description}
                </BCTypography>
                <BCTypography
                  sx={{ fontSize: 18, color: LINK, textAlign: 'right' }}
                >
                  ›
                </BCTypography>
              </Box>
            ))}
          </BCBox>

          {/* Legislation and requirements */}
          <BCTypography
            variant="h2"
            sx={{ fontSize: 22, fontWeight: 700, color: DARK, mt: 5, mb: 2 }}
          >
            {t('publicDashboard.legislation.title')}
          </BCTypography>
          <BCBox
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2
            }}
          >
            {[
              {
                href: LEGISLATION_URL,
                label: t('publicDashboard.legislation.renewable')
              },
              {
                href: REQUIREMENTS_URL,
                label: t('publicDashboard.legislation.requirements')
              }
            ].map((l) => (
              <Box
                key={l.href}
                component="a"
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                data-test="legislation-link"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  border: '1px solid #D8D8D8',
                  borderRadius: '6px',
                  p: '16px 20px',
                  textDecoration: 'none',
                  color: LINK,
                  fontWeight: 700,
                  fontSize: 15.5,
                  '&:hover': { background: '#F2F7FC', borderColor: '#B7CCE0' }
                }}
              >
                {l.label}
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </Box>
            ))}
          </BCBox>
        </BCBox>
      </BCBox>

      {/* Login CTA band */}
      <BCBox sx={{ ...fullBleed, backgroundColor: NAVY, mt: 'auto' }}>
        <BCBox
          sx={{
            ...innerContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
            py: 3.5,
            flexWrap: 'wrap'
          }}
        >
          <BCTypography sx={{ fontSize: 17, color: '#fff', maxWidth: 640 }}>
            {t('publicDashboard.login.prompt')}
          </BCTypography>
          {renderLoginButtons()}
        </BCBox>
      </BCBox>
    </BCBox>
  )
}

export default PublicDashboard
