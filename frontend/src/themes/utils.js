import chroma from 'chroma-js'

// function to convert pixels to rem
export const pxToRem = (number, baseNumber = 16) => `${number / baseNumber}rem`

// function to convert hex value to rgba
export const hexToRgb = (color) => chroma(color).rgb().join(', ')

// function to convert rgb value to rgba to add opacity
export const rgba = (color, opacity) => `rgba(${hexToRgb(color)}, ${opacity})`

// Linear Gradient function helps to create a linear gradient color background
export const linearGradient = (color, colorState, angle = 195) =>
  `linear-gradient(${angle}deg, ${color}, ${colorState})`

export const boxShadow = (
  offset = [],
  radius = [],
  color,
  opacity,
  inset = ''
) => {
  const [x, y] = offset
  const [blur, spread] = radius

  return `${inset} ${pxToRem(x)} ${pxToRem(y)} ${pxToRem(blur)} ${pxToRem(
    spread
  )} ${rgba(color, opacity)}`
}
