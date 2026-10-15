// @mui material components
import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { CSSObject } from '@emotion/react'

interface ColorToken {
  main: string
  focus: string
}

interface ExtendedTheme extends Theme {
  palette: Theme['palette'] & {
    white: ColorToken
    text: ColorToken
    transparent: ColorToken
    gradients: Record<string, { main: string; state: string }>
    primary: ColorToken
    light: ColorToken
  }
  functions: {
    boxShadow: (
      offset: [number, number],
      blur: [number, number],
      color: string,
      opacity: number
    ) => string
    linearGradient: (main: string, state: string) => string
    pxToRem: (value: number) => string
    rgba: (color: string, opacity: number) => string
  }
  borders: { borderRadius: { section: string } }
  boxShadows: { colored: Record<string, string> }
}

// Define the ownerState interface for BCButton
interface BCButtonOwnerState {
  color: string
  variant: string
  size: string
  circular: boolean
  iconOnly: boolean
}

const BCButtonRoot = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'ownerState'
})<{ ownerState: BCButtonOwnerState }>(({ theme, ownerState }) => {
  const { palette, functions, borders, boxShadows } =
    theme as ExtendedTheme
  const { color, variant, size, circular, iconOnly } = ownerState
  const { white, text, transparent, gradients, primary, light } = palette
  const { boxShadow, linearGradient, pxToRem, rgba } = functions
  const { borderRadius } = borders
  const { colored } = boxShadows
  const getColor = (name: string): ColorToken | undefined =>
    (palette as unknown as Record<string, ColorToken>)[name]

  // styles for the button with variant="contained"
  const containedStyles = () => {
    // background color value
    const backgroundValue = getColor(color)
      ? getColor(color).main
      : white.main

    // backgroundColor value when button is focused
    const focusedBackgroundValue = getColor(color)
      ? getColor(color).focus
      : white.focus

    // boxShadow value
    const boxShadowValue = colored[color]
      ? `${boxShadow([0, 3], [3, 0], getColor(color).main, 0.15)}, ${boxShadow(
          [0, 3],
          [1, -2],
          getColor(color).main,
          0.2
        )}, ${boxShadow([0, 1], [5, 0], getColor(color).main, 0.15)}`
      : 'none'

    // boxShadow value when button is hovered
    const hoveredBoxShadowValue = colored[color]
      ? `${boxShadow(
          [0, -10],
          [26, -32],
          getColor(color).main,
          0.4
        )}, ${boxShadow(
          [0, 4],
          [23, 0],
          getColor(color).main,
          0.15
        )}, ${boxShadow([0, 8], [10, -5], getColor(color).main, 0.2)}`
      : 'none'

    // color value
    const needsDarkText =
      color === 'white' ||
      color === 'light' ||
      color === 'glacier' ||
      !getColor(color)

    const colorValue = needsDarkText ? text.main : white.main

    // color value when button is focused
    const focusedColorValue = needsDarkText ? text.main : white.main

    // determine hover boxShadow color
    const hoverTextColor = needsDarkText ? text.main : white.main

    return {
      border: '1px solid rgba(0, 51, 102)',
      background: backgroundValue,
      color: colorValue,
      boxShadow: boxShadowValue,
      textTransform: 'none',
      fontSize: pxToRem(16),
      fontWeight: '400',

      '&:hover': {
        backgroundColor: focusedBackgroundValue,
        color: hoverTextColor,
        borderColor: colorValue,
        opacity: 0.85,
        boxShadow: hoveredBoxShadowValue
      },

      '&:focus:not(:hover)': {
        backgroundColor: focusedBackgroundValue,
        boxShadow: getColor(color)
          ? boxShadow([0, 0], [0, 3.2], getColor(color).main, 0.5)
          : boxShadow([0, 0], [0, 3.2], white.main, 0.5)
      },

      '&:disabled': {
        backgroundColor: backgroundValue,
        color: focusedColorValue,
        opacity: 0.3
      }
    }
  }

  // styles for the button with variant="outlined"
  const outlinedStyles = () => {
    // background color value
    const backgroundValue =
      color === 'white' ? rgba(white.main, 0.8) : transparent.main
    let focusedBackgroundValue = white.focus
    if (color === 'white') {
      focusedBackgroundValue = primary.main
    } else if (color === 'light') {
      focusedBackgroundValue = 'transparent'
    } else if (getColor(color)) {
      focusedBackgroundValue = getColor(color).focus
    }
    // color value
    const colorValue = getColor(color)
      ? getColor(color).main
      : white.main

    // boxShadow value
    const boxShadowValue = getColor(color)
      ? boxShadow([0, 0], [0, 3.2], getColor(color).main, 0.5)
      : boxShadow([0, 0], [0, 3.2], white.main, 0.5)

    // border color value
    let borderColorValue = getColor(color)
      ? getColor(color).main
      : rgba(white.main, 0.75)

    if (color === 'white') {
      borderColorValue = rgba(white.main, 0.75)
    }

    return {
      background: backgroundValue,
      color: colorValue,
      borderColor: borderColorValue,
      textTransform: 'none',
      fontSize: pxToRem(16),
      fontWeight: '400',

      '&:hover': {
        background: focusedBackgroundValue,
        color: light.main,
        borderColor: borderColorValue
      },

      '&:focus:not(:hover)': {
        background: color === 'white' ? colorValue : transparent.main,
        boxShadow: boxShadowValue
      },

      '&:active:not(:hover)': {
        backgroundColor: colorValue,
        color: white.main,
        opacity: 0.85
      },

      '&:disabled': {
        color: colorValue,
        borderColor: colorValue,
        opacity: 0.3
      }
    }
  }

  // styles for the button with variant="gradient"
  const gradientStyles = () => {
    // background value
    const backgroundValue =
      color === 'white' || !gradients[color]
        ? white.main
        : linearGradient(
            gradients[color].main,
            gradients[color].state
          )

    // boxShadow value
    const boxShadowValue = colored[color]
      ? `${boxShadow([0, 3], [3, 0], getColor(color).main, 0.15)}, ${boxShadow(
          [0, 3],
          [1, -2],
          getColor(color).main,
          0.2
        )}, ${boxShadow([0, 1], [5, 0], getColor(color).main, 0.15)}`
      : 'none'

    // boxShadow value when button is hovered
    const hoveredBoxShadowValue = colored[color]
      ? `${boxShadow(
          [0, 14],
          [26, -12],
          getColor(color).main,
          0.4
        )}, ${boxShadow(
          [0, 4],
          [23, 0],
          getColor(color).main,
          0.15
        )}, ${boxShadow([0, 8], [10, -5], getColor(color).main, 0.2)}`
      : 'none'

    // color value
    let colorValue = white.main

    if (color === 'white') {
      colorValue = text.main
    } else if (color === 'light') {
      colorValue = gradients.dark.state
    }

    return {
      background: backgroundValue,
      color: colorValue,
      boxShadow: boxShadowValue,
      textTransform: 'none',
      fontSize: pxToRem(16),
      fontWeight: '400',

      '&:hover': {
        boxShadow: hoveredBoxShadowValue
      },

      '&:focus:not(:hover)': {
        boxShadow: boxShadowValue
      },

      '&:disabled': {
        background: backgroundValue,
        color: colorValue
      }
    }
  }

  // styles for the button with variant="text"
  const textStyles = () => {
    // color value
    const colorValue = getColor(color)
      ? getColor(color).main
      : white.main

    // color value when button is focused
    const focusedColorValue = getColor(color)
      ? getColor(color).focus
      : white.focus

    return {
      color: colorValue,

      '&:hover': {
        color: focusedColorValue
      },

      '&:focus:not(:hover)': {
        color: focusedColorValue
      }
    }
  }

  // styles for the button with circular={true}
  const circularStyles = () => ({
    borderRadius: borderRadius.section
  })

  // styles for the button with iconOnly={true}
  const iconOnlyStyles = () => {
    // width, height, minWidth and minHeight values
    let sizeValue = pxToRem(38)

    if (size === 'small') {
      sizeValue = pxToRem(25.4)
    } else if (size === 'large') {
      sizeValue = pxToRem(52)
    }

    // padding value
    let paddingValue = `${pxToRem(11)} ${pxToRem(11)} ${pxToRem(10)}`

    if (size === 'small') {
      paddingValue = pxToRem(4.5)
    } else if (size === 'large') {
      paddingValue = pxToRem(16)
    }

    return {
      width: sizeValue,
      minWidth: sizeValue,
      height: sizeValue,
      minHeight: sizeValue,
      padding: paddingValue,

      '& .material-icons': {
        marginTop: 0
      },

      '&:hover, &:focus, &:active': {
        transform: 'none'
      }
    }
  }

  return {
    ...(variant === 'contained' && containedStyles()),
    ...(variant === 'outlined' && outlinedStyles()),
    ...(variant === 'gradient' && gradientStyles()),
    ...(variant === 'text' && textStyles()),
    ...(circular && circularStyles()),
    ...(iconOnly && iconOnlyStyles()),
    maxHeight: pxToRem(39)
  } as CSSObject
})

export default BCButtonRoot
