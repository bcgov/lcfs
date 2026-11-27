// Shared layout for the Organization details card so label/value pairs line up
// the way they do in the design wireframe.
export const ROW_LABEL_WIDTH = 340

// A label/value pair: bold label (at least labelWidth wide, never wrapped)
// followed by its value.
export const fieldLabelSx = (labelWidth) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: 1,
  '& > strong': {
    flex: '0 0 auto',
    minWidth: labelWidth,
    whiteSpace: 'nowrap'
  }
})

// Compact radios whose rows are no taller than a line of text, so the settings
// rows are spaced exactly like the label/value rows above them.
export const compactRadioProps = {
  size: 'small',
  sx: { py: 0, my: '-2px' }
}

// Height of a standard small MUI text input. A row that can reveal one reserves
// this much space up front, so it never changes height when the input appears.
export const TEXT_INPUT_HEIGHT = 40
