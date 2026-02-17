// @mui material components
import Badge from '@mui/material/Badge'
import { styled } from '@mui/material/styles'
import shadows from '@mui/material/styles/shadows'
import type { ReactNode } from 'react'

export type BCBadgeColor =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'light'
  | 'dark'
  | 'smoky'

export type BCBadgeVariant = 'gradient' | 'contained' | 'outlined'
export type BCBadgeSize = 'xs' | 'sm' | 'md' | 'lg'

interface BCBadgeOwnerState {
  color: BCBadgeColor
  variant: BCBadgeVariant
  size: BCBadgeSize
  circular: boolean
  indicator: boolean
  border: boolean
  container: boolean
  children?: ReactNode
}

const defaultShadows = shadows as unknown as Record<string, string>

const BCBadgeRoot = styled(Badge, {
  shouldForwardProp: (prop) => prop !== 'ownerState'
})<{ ownerState: BCBadgeOwnerState }>(({ theme, ownerState }) => {
  const { palette, typography, borders, functions } = theme as any
  const {
    color,
    circular,
    border,
    size,
    indicator,
    variant,
    container,
    children
  } = ownerState

  const { white, dark, gradients, badgeColors, transparent } = palette as any
  const { size: fontSize, fontWeightBold } = typography
  const { borderRadius, borderWidth } = borders as any
  const { pxToRem, linearGradient } = functions as any

  // padding values
  const paddings: Record<BCBadgeSize, string> = {
    xs: '0.45em 0.775em',
    sm: '0.55em 0.9em',
    md: '0.65em 1em',
    lg: '0.85em 1.375em'
  }

  // fontSize value
  const fontSizeValue = size === 'xs' ? fontSize.xxs : fontSize.xs

  // border value
  const borderValue = border ? `${borderWidth[3]} solid ${white.main}` : 'none'

  // borderRadius value
  const borderRadiusValue = circular ? borderRadius.section : borderRadius.md

  // styles for the badge with indicator={true}
  const indicatorStyles = (sizeProp: string) => {
    let widthValue = pxToRem(20)
    let heightValue = pxToRem(20)

    if (sizeProp === 'medium') {
      widthValue = pxToRem(24)
      heightValue = pxToRem(24)
    } else if (sizeProp === 'large') {
      widthValue = pxToRem(32)
      heightValue = pxToRem(32)
    }

    return {
      width: widthValue,
      height: heightValue,
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
      borderRadius: '50%',
      padding: 0,
      border: borderValue
    }
  }

  // styles for the badge with variant="gradient"
  const gradientStyles = () => {
    const backgroundValue = gradients[color]
      ? linearGradient(gradients[color].main, gradients[color].state)
      : linearGradient(gradients.info.main, gradients.info.state)
    const colorValue = color === 'light' ? dark.main : white.main

    return {
      background: backgroundValue,
      color: colorValue
    }
  }

  // styles for the badge with variant="contained"
  const containedStyles = () => {
    const backgroundValue = badgeColors[color]
      ? badgeColors[color].background
      : badgeColors.info.background
    let colorValue = badgeColors[color]
      ? badgeColors[color].text
      : badgeColors.info.text

    if (color === 'light') {
      colorValue = dark.main
    }
    return {
      background: backgroundValue,
      color: colorValue
    }
  }

  const outlinedStyles = () => ({
    backgroundValue: transparent.main,
    color: 'inherit',
    border: `${borderWidth[2]} solid ${badgeColors[color].background}`,
    borderRadius: borderRadius.md,
    boxShadow: defaultShadows.sm
  })

  const standAloneStyles = () => ({
    position: 'static',
    transform: 'none',
    fontSize: pxToRem(9)
  })

  const containerStyles = () => ({
    position: 'relative',
    transform: 'none'
  })

  return {
    '& .MuiBadge-badge': {
      height: 'auto',
      padding: paddings[size] || paddings.xs,
      fontSize: fontSizeValue,
      fontWeight: fontWeightBold,
      textTransform: 'none',
      lineHeight: 1,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      verticalAlign: 'baseline',
      border: borderValue,
      borderRadius: borderRadiusValue,
      ...(indicator && indicatorStyles(size)),
      ...(variant === 'gradient' && gradientStyles()),
      ...(variant === 'contained' && containedStyles()),
      ...(variant === 'outlined' && outlinedStyles()),
      ...(!children && !container && standAloneStyles()),
      ...(container && containerStyles())
    }
  }
})

export default BCBadgeRoot
