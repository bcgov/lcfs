import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  AutoAwesome,
  Description,
  ElectricBolt,
  FactCheck,
  Gavel,
  Handshake,
  LocalGasStation,
  Recycling,
  Summarize,
  SwapHoriz,
  UploadFile
} from '@mui/icons-material'
import { useEffect, useMemo, useRef, useState } from 'react'

const HEADER_OFFSET = 96
const CLOSE_DELAY_MS = 180

const navIconMap = {
  'report-section-analyst-review': AutoAwesome,
  'report-section-review-actions': FactCheck,
  'report-section-supportingDocs': UploadFile,
  'report-section-fuelSupplies': LocalGasStation,
  'report-section-finalSupplyEquipments': ElectricBolt,
  'report-section-allocationAgreements': Handshake,
  'report-section-notionalTransfers': SwapHoriz,
  'report-section-otherUses': Recycling,
  'report-section-fuelExports': Description,
  'report-section-summary': Summarize,
  'report-section-assessment': Gavel
}

export const ComplianceReportPageNav = ({ items = [] }) => {
  const [availableIds, setAvailableIds] = useState([])
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const closeTimerRef = useRef(null)

  const visibleItems = useMemo(
    () => items.filter((item) => availableIds.includes(item.id)),
    [items, availableIds]
  )

  useEffect(() => {
    const refreshAvailableIds = () => {
      setAvailableIds(
        items
          .map((item) => item.id)
          .filter((id) => Boolean(document.getElementById(id)))
      )
    }

    refreshAvailableIds()
    const observer = new MutationObserver(refreshAvailableIds)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    if (!availableIds.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible?.target?.id) {
          setActiveId(visible.target.id)
        }
      },
      {
        rootMargin: `-${HEADER_OFFSET}px 0px -55% 0px`,
        threshold: [0.08, 0.18, 0.32]
      }
    )

    availableIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [availableIds])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  if (visibleItems.length < 2) return null

  const openNav = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setIsOpen(true)
  }

  const closeNav = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false)
      closeTimerRef.current = null
    }, CLOSE_DELAY_MS)
  }

  const handleClick = (id) => {
    const element = document.getElementById(id)
    if (!element) return

    const top =
      element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
    setActiveId(id)
  }

  return (
    <BCBox
      aria-label="Compliance report page sections"
      sx={{
        position: 'fixed',
        right: { xs: 8, xl: 18 },
        top: '65%',
        transform: 'translateY(-50%)',
        zIndex: 1200,
        display: { xs: 'none', lg: 'flex' },
        alignItems: 'center'
      }}
    >
      <BCBox
        sx={{
          width: isOpen ? { lg: 238, xl: 264 } : 0,
          maxWidth: { lg: 238, xl: 264 },
          maxHeight: 'calc(100vh - 156px)',
          mr: isOpen ? 1 : 0,
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateX(0)' : 'translateX(10px)',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition:
            'width 160ms ease, opacity 160ms ease, transform 160ms ease, margin 160ms ease'
        }}
      >
        <BCBox
          className="custom-scrollbar"
          onMouseEnter={openNav}
          onMouseLeave={closeNav}
          sx={{
            maxHeight: 'calc(100vh - 156px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            border: '1px solid rgba(0, 0, 0, 0.16)',
            borderRadius: '12px',
            backgroundColor: '#fff',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.18)',
            py: 1,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0, 0, 0, 0.28) transparent',
            '&::-webkit-scrollbar': { width: 8 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.24)',
              borderRadius: 8
            }
          }}
        >
          <BCBox sx={{ px: 1.25, py: 1 }}>
            <BCTypography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0,
                fontWeight: 700
              }}
            >
              Report sections
            </BCTypography>
          </BCBox>
          {visibleItems.map((item, index) => {
            const isActive = activeId === item.id
            const Icon = navIconMap[item.id] || Description
            return (
              <BCBox
                key={item.id}
                component="button"
                type="button"
                onFocus={openNav}
                onClick={() => handleClick(item.id)}
                aria-label={`Go to ${item.label}`}
                aria-current={isActive ? 'location' : undefined}
                sx={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '22px 1fr',
                  alignItems: 'start',
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  border: 0,
                  borderLeft: '3px solid',
                  borderLeftColor: isActive ? 'primary.main' : 'transparent',
                  backgroundColor: isActive
                    ? 'rgba(0, 51, 102, 0.08)'
                    : 'transparent',
                  color: isActive ? 'primary.main' : 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition:
                    'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 51, 102, 0.06)',
                    color: 'primary.main'
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '-2px'
                  }
                }}
              >
                <Icon
                  sx={{
                    mt: '2px',
                    fontSize: 18,
                    color: isActive ? 'primary.main' : 'text.secondary'
                  }}
                />
                <BCBox>
                  <BCTypography
                    component="span"
                    sx={{
                      display: 'block',
                      color: 'inherit',
                      fontSize: '0.82rem',
                      lineHeight: 1.25,
                      fontWeight: isActive ? 700 : 500
                    }}
                  >
                    {item.label}
                  </BCTypography>
                  {index === 0 && (
                    <BCTypography
                      component="span"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        fontSize: '0.72rem',
                        lineHeight: 1.2,
                        mt: 0.25
                      }}
                    >
                      Jump between report areas
                    </BCTypography>
                  )}
                </BCBox>
              </BCBox>
            )
          })}
        </BCBox>
      </BCBox>

      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          py: 1,
          px: 0.5,
          borderRadius: '999px',
          backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
          boxShadow: isOpen ? '0 8px 20px rgba(0, 0, 0, 0.12)' : 'none',
          transition: 'background-color 140ms ease, box-shadow 140ms ease'
        }}
      >
        {visibleItems.map((item) => {
          const isActive = activeId === item.id
          return (
            <BCBox
              key={item.id}
              component="button"
              type="button"
              onMouseEnter={openNav}
              onMouseLeave={closeNav}
              onFocus={openNav}
              onClick={() => handleClick(item.id)}
              aria-label={`Go to ${item.label}`}
              aria-current={isActive ? 'location' : undefined}
              sx={{
                width: isActive ? 22 : 14,
                height: 2,
                p: 0,
                border: 0,
                borderRadius: '2px',
                cursor: 'pointer',
                backgroundColor: isActive
                  ? 'primary.main'
                  : 'rgba(0, 0, 0, 0.38)',
                transition:
                  'width 140ms ease, background-color 140ms ease, opacity 140ms ease',
                opacity: isActive ? 1 : 0.72,
                '&:hover': {
                  width: 24,
                  opacity: 1,
                  backgroundColor: 'primary.main'
                },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '3px'
                }
              }}
            />
          )
        })}
      </BCBox>
    </BCBox>
  )
}
