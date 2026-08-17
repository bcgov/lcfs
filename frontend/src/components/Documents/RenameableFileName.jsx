import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Box, IconButton, TextField, Tooltip } from '@mui/material'
import { Check, Close, Edit } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

const splitExtension = (name) => {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) {
    return { base: name, ext: '' }
  }
  return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) }
}

const RenameableFileName = ({
  displayName,
  canRename,
  disabled,
  onRename,
  renderName
}) => {
  const { t } = useTranslation('common')
  const [isEditing, setIsEditing] = useState(false)
  const { base: initialBase, ext } = splitExtension(displayName)
  const [value, setValue] = useState(initialBase)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isEditing) {
      setValue(splitExtension(displayName).base)
    }
  }, [displayName, isEditing])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const startEditing = () => {
    setError(null)
    setValue(splitExtension(displayName).base)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setValue(splitExtension(displayName).base)
    setError(null)
  }

  const save = async () => {
    const trimmedBase = value.trim()
    if (!trimmedBase) {
      setError(t('common:renameFailed'))
      return
    }
    const newName = `${trimmedBase}${ext}`
    if (newName === displayName) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onRename(newName)
      setIsEditing(false)
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.message || t('common:renameFailed')
      )
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  if (!isEditing) {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 0.5 }}
      >
        {renderName(displayName)}
        {canRename && (
          <Tooltip title={t('common:renameBtn')}>
            <span>
              <IconButton
                aria-label={t('common:renameFileAria', {
                  fileName: displayName
                })}
                size="small"
                onClick={startEditing}
                disabled={disabled}
                data-test="rename-file-button"
              >
                <Edit fontSize="inherit" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        width: '100%'
      }}
    >
      <TextField
        inputRef={inputRef}
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        error={!!error}
        helperText={error}
        disabled={saving}
        InputProps={{
          endAdornment: ext ? (
            <Box
              component="span"
              sx={{ color: 'text.secondary', whiteSpace: 'nowrap', pl: 0.25 }}
              data-test="rename-file-extension"
            >
              {ext}
            </Box>
          ) : undefined
        }}
        inputProps={{
          'aria-label': t('common:renameFileInputAria'),
          maxLength: 255,
          'data-test': 'rename-file-input'
        }}
        sx={{ flex: 1, minWidth: 0 }}
      />
      <Tooltip title={t('common:saveBtn')}>
        <span>
          <IconButton
            aria-label={t('common:saveBtn')}
            size="small"
            onClick={save}
            disabled={saving}
            data-test="rename-file-save"
          >
            <Check fontSize="inherit" color="success" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('common:cancelBtn')}>
        <span>
          <IconButton
            aria-label={t('common:cancelBtn')}
            size="small"
            onClick={cancelEditing}
            disabled={saving}
            data-test="rename-file-cancel"
          >
            <Close fontSize="inherit" color="error" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )
}

RenameableFileName.propTypes = {
  displayName: PropTypes.string.isRequired,
  canRename: PropTypes.bool,
  disabled: PropTypes.bool,
  onRename: PropTypes.func.isRequired,
  renderName: PropTypes.func.isRequired
}

RenameableFileName.defaultProps = {
  canRename: false,
  disabled: false
}

export default RenameableFileName
