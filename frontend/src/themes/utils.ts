import chroma from 'chroma-js'

// function to convert pixels to rem
export const pxToRem = (number: number, baseNumber = 16) =>
  `${number / baseNumber}rem`

// function to convert hex value to rgba
export const hexToRgb = (color: string) => chroma(color).rgb().join(', ')

// function to convert rgb value to rgba to add opacity
export const rgba = (color: string, opacity: number) =>
  `rgba(${hexToRgb(color)}, ${opacity})`

// Linear Gradient function helps to create a linear gradient color background
export const linearGradient = (
  color: string,
  colorState: string,
  angle = 195
) => `linear-gradient(${angle}deg, ${color}, ${colorState})`

export const boxShadow = (
  offset: number[] = [],
  radius: number[] = [],
  color: string,
  opacity: number,
  inset = ''
) => {
  const [x, y] = offset
  const [blur, spread] = radius

  return `${inset} ${pxToRem(x)} ${pxToRem(y)} ${pxToRem(blur)} ${pxToRem(
    spread
  )} ${rgba(color, opacity)}`
}
