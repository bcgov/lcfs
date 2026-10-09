import Box from '@mui/material/Box'
import * as echarts from 'echarts/core'
import { AriaComponent } from 'echarts/components'
import { useEffect, useRef } from 'react'

echarts.use([AriaComponent])

const getAccessibleOption = (option, ariaLabel, ariaDescription) => {
  if (!option || typeof option !== 'object') return option

  const existingAria = option.aria || {}
  const existingLabel = existingAria.label || {}
  const description =
    ariaDescription ?? existingLabel.description ?? existingAria.description
  const hasExplicitDescription = description != null
  const title = Array.isArray(option.title)
    ? option.title.find((item) => item?.text)?.text
    : option.title?.text
  const general = { ...existingLabel.general }

  if (ariaLabel && !hasExplicitDescription) {
    if (title) {
      general.withTitle = ariaLabel.includes(String(title))
        ? ariaLabel
        : `${ariaLabel}. ${title}`
    } else {
      general.withoutTitle = ariaLabel
    }
  }

  return {
    ...option,
    aria: {
      ...existingAria,
      enabled: existingAria.enabled ?? existingAria.show ?? true,
      ...(description != null || Object.keys(general).length
        ? {
            label: {
              ...existingLabel,
              ...(description != null ? { description } : {}),
              ...(Object.keys(general).length ? { general } : {})
            }
          }
        : {})
    }
  }
}

export const BCResponsiveEChart = ({
  option,
  height = 300,
  ariaLabel = undefined,
  ariaDescription = undefined,
  ariaDescribedBy = undefined,
  tabIndex = 0,
  sx = undefined
}) => {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    chartInstance.current = echarts.init(chartRef.current)

    const handleResize = () => {
      chartInstance.current?.resize()
    }

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(chartRef.current)
    } else {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener('resize', handleResize)
      }

      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartInstance.current || !option) return
    chartInstance.current.setOption(
      getAccessibleOption(option, ariaLabel, ariaDescription),
      true
    )
  }, [ariaDescription, ariaLabel, option])

  return (
    <Box
      ref={chartRef}
      role="img"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      tabIndex={tabIndex}
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        height,
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px'
        },
        ...sx
      }}
    />
  )
}
