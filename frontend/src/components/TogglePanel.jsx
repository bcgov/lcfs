import { Box, FormControlLabel } from '@mui/material'
import { useEffect, useState } from 'react'
import Switch from '@mui/material/Switch'

export const TogglePanel = ({
  label,
  offComponent,
  onComponent,
  defaultState = false,
  disabled = false
}) => {
  const [isToggle, setToggle] = useState(false)

  useEffect(() => {
    setToggle(defaultState)
  }, [defaultState])

  if (disabled) {
    return offComponent
  }

  return (
    <Box>
      <FormControlLabel
        aria-label="Toggle compare mode"
        control={
          <Switch checked={isToggle} onChange={() => setToggle(!isToggle)} />
        }
        label={
          <Box sx={{ pt: 1, pb: 1 }}>{`${label} ${
            isToggle ? 'on' : 'off'
          }`}</Box>
        }
      />
      <Box>
        {isToggle && onComponent}
        {!isToggle && offComponent}
      </Box>
    </Box>
  )
}
