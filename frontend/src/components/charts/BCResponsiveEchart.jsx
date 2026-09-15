import { Box } from '@mui/material'
import * as echarts from 'echarts/core'
import { useEffect, useRef } from 'react'

export const BCResponsiveEChart = ({
  option,
  height = 300,
  ariaLabel = undefined,
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
    chartInstance.current.setOption(option, true)
  }, [option])

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
