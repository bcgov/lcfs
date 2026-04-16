import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Card,
  CardMedia,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Radio,
  TextField,
  Typography
} from '@mui/material'
import { CloudUpload, Edit } from '@mui/icons-material'
import { CircularProgress } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { CONFIG } from '@/constants/config'
import { apiRoutes } from '@/constants/routes'
import {
  useActivateLoginBgImage,
  useDeleteLoginBgImage,
  useLoginBgImages,
  useUpdateLoginBgImage,
  useUploadLoginBgImage
} from '@/hooks/useLoginBgImage'

const imageStreamUrl = (imageId) =>
  `${CONFIG.API_BASE}${apiRoutes.loginBgImageStream.replace(':imageId', imageId)}`

export function LoginScreenBackground() {
  const { t } = useTranslation(['admin'])

  const { data: images = [], isLoading } = useLoginBgImages()

  const [selectedId, setSelectedId] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // { id, displayName, caption }
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Upload form state
  const [file, setFile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [caption, setCaption] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const uploadMutation = useUploadLoginBgImage()
  const updateMutation = useUpdateLoginBgImage()
  const activateMutation = useActivateLoginBgImage()
  const deleteMutation = useDeleteLoginBgImage()

  const handleFileSelect = useCallback((selectedFile) => {
    if (selectedFile) setFile(selectedFile)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files?.[0]
      handleFileSelect(dropped)
    },
    [handleFileSelect]
  )

  const resetUploadForm = () => {
    setFile(null)
    setDisplayName('')
    setCaption('')
    setDragOver(false)
  }

  const handleUploadOpen = () => {
    resetUploadForm()
    setUploadOpen(true)
  }

  const handleUploadClose = () => {
    setUploadOpen(false)
    resetUploadForm()
  }

  const handleUploadSubmit = async () => {
    if (!file || !displayName.trim()) return
    await uploadMutation.mutateAsync({ file, displayName: displayName.trim(), caption: caption.trim() || null })
    handleUploadClose()
  }

  const handleEditOpen = (image) => {
    setEditTarget({
      id: image.loginBgImageId,
      displayName: image.displayName,
      caption: image.caption || ''
    })
  }

  const handleEditClose = () => setEditTarget(null)

  const handleEditSubmit = async () => {
    if (!editTarget || !editTarget.displayName.trim()) return
    await updateMutation.mutateAsync({
      imageId: editTarget.id,
      displayName: editTarget.displayName.trim(),
      caption: editTarget.caption.trim() || null
    })
    handleEditClose()
  }

  const handleSetBackground = async () => {
    if (!selectedId) return
    await activateMutation.mutateAsync(selectedId)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    await deleteMutation.mutateAsync(deleteConfirmId)
    if (selectedId === deleteConfirmId) setSelectedId(null)
    setDeleteConfirmId(null)
  }

  if (isLoading) return <Loading />

  return (
    <BCBox>
      <BCTypography variant="h5" mb={1}>
        {t('loginBg.title')}
      </BCTypography>
      <BCTypography variant="body2" color="text.secondary" mb={1}>
        {t('loginBg.description')}
      </BCTypography>
      <BCTypography
        variant="body2"
        color="text.secondary"
        mb={3}
        dangerouslySetInnerHTML={{ __html: t('loginBg.recommended') }}
      />

      <Grid container spacing={2}>
        {images.map((image) => (
          <Grid item xs={12} sm={6} md={4} key={image.loginBgImageId}>
            <Card
              sx={{
                position: 'relative',
                cursor: 'pointer',
                outline: selectedId === image.loginBgImageId ? '3px solid #003366' : 'none',
                borderRadius: 1
              }}
              onClick={() => setSelectedId(image.loginBgImageId)}
            >
              <CardMedia
                component="img"
                height="160"
                image={imageStreamUrl(image.loginBgImageId)}
                alt={image.displayName}
                sx={{ objectFit: 'cover' }}
              />

              {/* Edit button overlay */}
              <BCButton
                size="small"
                variant="contained"
                color="primary"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  minWidth: 0,
                  px: 1,
                  fontSize: '0.7rem'
                }}
                startIcon={<Edit fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEditOpen(image)
                }}
              >
                {t('loginBg.editImageBtn')}
              </BCButton>

              {/* Active badge */}
              {image.isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'success.main',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.7rem',
                    fontWeight: 'bold'
                  }}
                >
                  {t('loginBg.active')}
                </Box>
              )}

              {/* Footer */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  px: 1,
                  py: 0.5
                }}
              >
                <Box>
                  <Typography variant="caption" display="block" fontWeight="bold">
                    {image.displayName}
                  </Typography>
                  {image.caption && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {image.caption}
                    </Typography>
                  )}
                </Box>
                <FormControlLabel
                  control={
                    <Radio
                      size="small"
                      checked={selectedId === image.loginBgImageId}
                      onChange={() => setSelectedId(image.loginBgImageId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                  label={
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmId(image.loginBgImageId)
                      }}
                    >
                      {t('loginBg.delete')}
                    </Typography>
                  }
                  labelPlacement="start"
                  sx={{ mr: 0 }}
                />
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Bottom action buttons */}
      <Box mt={3} display="flex" gap={2}>
        <BCButton
          variant="outlined"
          color="primary"
          startIcon={<CloudUpload />}
          onClick={handleUploadOpen}
        >
          {t('loginBg.uploadImageBtn')}
        </BCButton>
        <BCButton
          variant="contained"
          color="primary"
          disabled={!selectedId || activateMutation.isPending}
          onClick={handleSetBackground}
        >
          {t('loginBg.setBackgroundBtn')}
        </BCButton>
      </Box>

      {/* Upload / Edit modal */}
      <Dialog
        open={uploadOpen || !!editTarget}
        onClose={editTarget ? handleEditClose : handleUploadClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editTarget ? t('loginBg.editTitle') : t('loginBg.uploadTitle')}
        </DialogTitle>
        <DialogContent>
          {!editTarget && (
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'grey.400',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: dragOver ? 'action.hover' : 'background.paper',
                mb: 2
              }}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'grey.500', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {t('loginBg.dragDropText')}{' '}
                <Typography component="span" color="primary" sx={{ textDecoration: 'underline' }}>
                  {t('loginBg.clickToSelect')}
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {t('loginBg.minResolution')}
              </Typography>
              {file && (
                <Typography variant="body2" color="success.main" mt={1}>
                  {t('loginBg.selected', { fileName: file.name })}
                </Typography>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </Box>
          )}

          <BCTypography variant="body2" sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}>
            {t('loginBg.nameLabel')}
          </BCTypography>
          <TextField
            fullWidth
            size="small"
            value={editTarget ? editTarget.displayName : displayName}
            onChange={(e) =>
              editTarget
                ? setEditTarget((prev) => ({ ...prev, displayName: e.target.value }))
                : setDisplayName(e.target.value)
            }
            placeholder={t('loginBg.namePlaceholder')}
          />
          <BCTypography variant="body2" sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}>
            {t('loginBg.captionLabel')}
          </BCTypography>
          <TextField
            fullWidth
            size="small"
            value={editTarget ? editTarget.caption : caption}
            onChange={(e) =>
              editTarget
                ? setEditTarget((prev) => ({ ...prev, caption: e.target.value }))
                : setCaption(e.target.value)
            }
            placeholder={t('loginBg.captionPlaceholder')}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BCButton
            variant="outlined"
            color="dark"
            onClick={editTarget ? handleEditClose : handleUploadClose}
          >
            {t('loginBg.cancelBtn')}
          </BCButton>
          <BCButton
            variant="contained"
            color="primary"
            disabled={
              editTarget
                ? !editTarget.displayName.trim() || updateMutation.isPending
                : !file || !displayName.trim() || uploadMutation.isPending
            }
            onClick={editTarget ? handleEditSubmit : handleUploadSubmit}
            startIcon={
              (editTarget ? updateMutation.isPending : uploadMutation.isPending)
                ? <CircularProgress size={16} color="inherit" />
                : null
            }
          >
            {editTarget ? t('loginBg.saveChangesBtn') : t('loginBg.uploadImageBtn')}
          </BCButton>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('loginBg.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('loginBg.deleteConfirmMessage')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BCButton
            variant="outlined"
            color="dark"
            onClick={() => setDeleteConfirmId(null)}
          >
            {t('loginBg.cancelBtn')}
          </BCButton>
          <BCButton
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={handleDeleteConfirm}
          >
            {t('loginBg.deleteBtn')}
          </BCButton>
        </DialogActions>
      </Dialog>
    </BCBox>
  )
}
