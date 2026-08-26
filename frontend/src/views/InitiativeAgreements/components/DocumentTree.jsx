import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  TextField
} from '@mui/material'
import {
  DOCUMENT_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  isDocumentRenameEnabled
} from '@/constants/common'
import { validateFile } from '@/utils/fileValidation'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import prettyBytes from 'pretty-bytes'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCModal from '@/components/BCModal'
import Loading from '@/components/Loading'
import { useDownloadDocument, useUpdateDocument } from '@/hooks/useDocuments'
import {
  useCreateFolder,
  useDeleteFolder,
  useDocumentTree,
  useFolderUpload,
  useMoveDocuments,
  useSoftDeleteDocument,
  useUpdateFolder
} from '@/hooks/useDocumentFolders'
import { DeletedItems } from './DeletedItems'
import { timezoneFormatter } from '@/utils/formatters'
import {
  ROOT_DROP_ID,
  collectDescendantFolderIds,
  docDragId,
  folderDragId,
  invertDocumentMove,
  resolveDrop
} from './documentTreeDnd'

// Folder tree for a designated action's evidence files (#4925). Phase 3
// adds dragging: files and folders move by pointer, multi-selections
// travel as one unit, OS file drops upload into the target folder, and
// every move offers an undo.

const AUTO_EXPAND_MS = 700

const NameEditor = ({ initialValue, onCommit, onCancel }) => (
  <TextField
    size="small"
    variant="standard"
    autoFocus
    defaultValue={initialValue}
    inputProps={{ 'data-test': 'folder-name-input' }}
    onFocus={(event) => event.target.select()}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      event.stopPropagation()
      if (event.key === 'Enter') {
        onCommit(event.target.value)
      } else if (event.key === 'Escape') {
        onCancel()
      }
    }}
  />
)

// Downloading is its own button, which frees the name to behave the way
// every other name in this tree does: double-click to rename. A rename
// only sets display_name, so the stored object keeps the key it was
// written under and nothing that points at it breaks.
const FileLabel = ({
  file,
  onDownload,
  onDelete,
  canRename,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: docDragId(file.documentId)
  })
  const displayName = file.displayName || file.fileName

  if (renaming) {
    return (
      <NameEditor
        initialValue={displayName}
        onCommit={onCommitRename}
        onCancel={onCancelRename}
      />
    )
  }

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.25,
        opacity: isDragging ? 0.4 : 1
      }}
      data-test={`tree-file-${file.documentId}`}
    >
      <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
      <BCTypography
        component="span"
        variant="subtitle2"
        onDoubleClick={(event) => {
          if (!canRename) return
          event.stopPropagation()
          onStartRename()
        }}
        sx={{ cursor: canRename ? 'text' : 'default' }}
      >
        {displayName}
      </BCTypography>
      <BCTypography component="span" variant="subtitle2" color="text.secondary">
        {prettyBytes(file.fileSize ?? 0)}
        {' · '}
        {timezoneFormatter({ value: file.createDate })}
      </BCTypography>
      {/* Double-click is the mouse shortcut, but it is only a shortcut:
          a rename reachable no other way would be mouse-only, which axe
          cannot see and a keyboard user cannot get past. */}
      {canRename && (
        <IconButton
          size="small"
          data-test={`tree-file-rename-${file.documentId}`}
          aria-label={t('initiativeAgreement:folders.renameFile', {
            name: displayName
          })}
          onClick={(event) => {
            event.stopPropagation()
            onStartRename()
          }}
        >
          <DriveFileRenameOutlineIcon fontSize="inherit" />
        </IconButton>
      )}
      <IconButton
        size="small"
        data-test={`tree-file-download-${file.documentId}`}
        aria-label={t('initiativeAgreement:folders.downloadFile', {
          name: displayName
        })}
        onClick={(event) => {
          event.stopPropagation()
          onDownload(file.documentId)
        }}
      >
        <FileDownloadOutlinedIcon fontSize="inherit" />
      </IconButton>
      {/* Removing a file sends it to the bin below; nothing is
          destroyed. */}
      <IconButton
        size="small"
        data-test={`tree-file-delete-${file.documentId}`}
        aria-label={t('initiativeAgreement:folders.deleteFile', {
          name: file.fileName
        })}
        onClick={(event) => {
          event.stopPropagation()
          onDelete(file.documentId)
        }}
      >
        <DeleteOutlineIcon fontSize="inherit" />
      </IconButton>
      <IconButton
        size="small"
        {...attributes}
        {...listeners}
        data-test={`tree-file-handle-${file.documentId}`}
        aria-label={t('initiativeAgreement:folders.fileDragHandle', {
          name: file.fileName
        })}
        sx={{ cursor: 'grab' }}
      >
        <DragIndicatorIcon fontSize="inherit" />
      </IconButton>
    </Box>
  )
}

const FolderLabel = ({
  folder,
  invalid,
  renaming,
  uploadingCount,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
  onStartRename,
  onOsFileDrop,
  externalDragSuppressed
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging
  } = useDraggable({
    id: folderDragId(folder.folderId),
    disabled: folder.isSystem
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folderDragId(folder.folderId),
    disabled: invalid
  })
  const [osDragOver, setOsDragOver] = useState(false)

  if (renaming) {
    return (
      <NameEditor
        initialValue={folder.name}
        onCommit={onCommitRename}
        onCancel={onCancelRename}
      />
    )
  }

  const isExternalFileDrag = (event) =>
    !externalDragSuppressed &&
    Array.from(event.dataTransfer?.types ?? []).includes('Files')

  return (
    <Box
      ref={setDropRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderRadius: 1,
        px: 0.5,
        opacity: invalid || isDragging ? 0.4 : 1,
        bgcolor: isOver || osDragOver ? 'action.selected' : 'transparent'
      }}
      data-test={`tree-folder-${folder.folderId}`}
      onDoubleClick={(event) => {
        if (folder.isSystem) return
        event.stopPropagation()
        onStartRename()
      }}
      onDragEnter={(event) => {
        if (isExternalFileDrag(event)) {
          event.preventDefault()
          setOsDragOver(true)
        }
      }}
      onDragOver={(event) => {
        if (isExternalFileDrag(event)) event.preventDefault()
      }}
      onDragLeave={() => setOsDragOver(false)}
      onDrop={(event) => {
        if (isExternalFileDrag(event)) {
          event.preventDefault()
          setOsDragOver(false)
          onOsFileDrop(Array.from(event.dataTransfer.files))
        }
      }}
    >
      <FolderOutlinedIcon fontSize="small" color="action" />
      {/* The drag handle is the name, not the whole row: the row also
          holds the actions button, and nesting one control inside another
          leaves neither reachable in order. */}
      <BCTypography
        component="span"
        variant="subtitle2"
        ref={setDragRef}
        {...attributes}
        {...listeners}
        aria-label={t('initiativeAgreement:folders.folderDragHandle', {
          name: folder.name
        })}
        sx={{ cursor: 'grab' }}
      >
        {folder.name}
      </BCTypography>
      {/* A drop is silent otherwise: the file only appears once the
          upload and the refetch are both done, which reads as nothing
          having happened. */}
      {uploadingCount > 0 && (
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          data-test={`folder-uploading-${folder.folderId}`}
        >
          <CircularProgress size={14} aria-hidden="true" />
          <BCTypography variant="body4" color="text.secondary">
            {t('initiativeAgreement:folders.uploading', {
              count: uploadingCount
            })}
          </BCTypography>
        </Box>
      )}
      <BCTypography component="span" variant="subtitle2" color="text.secondary">
        ({folder.documentCount})
      </BCTypography>
      {!folder.isSystem && (
        <IconButton
          size="small"
          data-test={`folder-menu-${folder.folderId}`}
          aria-label="folder actions"
          onClick={onOpenMenu}
        >
          <MoreVertIcon fontSize="inherit" />
        </IconButton>
      )}
    </Box>
  )
}

const RootDropZone = ({ visible, label }) => {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID })
  if (!visible) return null
  return (
    <Box
      ref={setNodeRef}
      data-test="root-drop-zone"
      sx={{
        mt: 1,
        p: 1,
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        borderRadius: 1,
        bgcolor: isOver ? 'action.selected' : 'transparent',
        textAlign: 'center'
      }}
    >
      <BCTypography variant="body4" color="text.secondary">
        {label}
      </BCTypography>
    </Box>
  )
}

export const DocumentTree = ({ parentType, parentID }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const { data: tree, isLoading } = useDocumentTree(parentType, parentID)
  const downloadDocument = useDownloadDocument(parentType, parentID)
  const { mutate: createFolder } = useCreateFolder(parentType, parentID)
  const { mutate: updateFolder } = useUpdateFolder(parentType, parentID)
  const { mutate: deleteFolder } = useDeleteFolder(parentType, parentID)
  const { mutate: moveDocuments } = useMoveDocuments(parentType, parentID)
  const { mutate: uploadToFolder } = useFolderUpload(parentType, parentID)
  const { mutate: deleteDocument } = useSoftDeleteDocument(parentType, parentID)
  const { mutateAsync: renameDocument } = useUpdateDocument(
    parentType,
    parentID
  )
  const canRenameFiles = isDocumentRenameEnabled(parentType)

  const [creating, setCreating] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renamingFileId, setRenamingFileId] = useState(null)
  const [menu, setMenu] = useState(null)
  // Deleting is reversible — the file goes to the bin — but it still
  // disappears from the tree, so it asks first.
  const [pendingDelete, setPendingDelete] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [expandedItems, setExpandedItems] = useState([])
  const seededExpansion = useRef(false)
  const [dragState, setDragState] = useState(null) // { activeId, invalid: Set }
  const [undo, setUndo] = useState(null) // { message, run }
  // Folder id -> number of files in flight, so the row that was dropped
  // on is the row that shows the spinner. Root drops key on 'root'.
  const [uploading, setUploading] = useState({})
  const [uploadError, setUploadError] = useState('')
  const hoverTimer = useRef(null)
  const uploadInputRef = useRef(null)
  const uploadTargetRef = useRef(null)

  const sensors = useSensors(
    // A few pixels of slack so click-to-download never starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Dragging must not be the only way to move something: space picks a
    // node up, the arrows move between targets, space drops it.
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    if (!seededExpansion.current && tree?.folders?.length) {
      setExpandedItems(tree.folders.map((f) => `folder-${f.folderId}`))
      seededExpansion.current = true
    }
  }, [tree])

  if (isLoading) {
    return <Loading message={t('initiativeAgreement:folders.loading')} />
  }

  const folders = tree?.folders ?? []
  const rootDocuments = tree?.rootDocuments ?? []

  const selectedDocumentIds = selectedItems
    .filter((id) => id.startsWith('doc-'))
    .map((id) => Number(id.slice(4)))

  const openMenu = (event, folder) => {
    event.stopPropagation()
    setMenu({ anchorEl: event.currentTarget, folder })
  }
  const closeMenu = () => setMenu(null)

  const commitCreate = (name) => {
    const trimmed = name.trim()
    if (trimmed) {
      createFolder({
        name: trimmed,
        parentFolderId: creating?.parentFolderId ?? null
      })
    }
    setCreating(null)
  }

  const commitRename = (folderId, name) => {
    const trimmed = name.trim()
    if (trimmed) {
      updateFolder({ folderId, name: trimmed })
    }
    setRenamingId(null)
  }

  const runDocumentMove = (documentIds, folderId) => {
    const inverse = invertDocumentMove(tree, documentIds)
    moveDocuments(
      { documentIds, folderId },
      {
        onSuccess: () => {
          setUndo({
            message: t('initiativeAgreement:folders.moved', {
              count: documentIds.length
            }),
            run: () =>
              inverse.forEach((group) =>
                moveDocuments({
                  documentIds: group.documentIds,
                  folderId: group.folderId
                })
              )
          })
        }
      }
    )
  }

  const handleDragStart = (event) => {
    const activeId = String(event.active.id)
    let invalid = new Set()
    if (activeId.startsWith('folder-')) {
      const folderId = Number(activeId.slice(7))
      invalid = collectDescendantFolderIds(folders, folderId)
      invalid.add(folderId)
    }
    setDragState({ activeId, invalid })
  }

  const handleDragOver = (event) => {
    const overId = event.over ? String(event.over.id) : null
    clearTimeout(hoverTimer.current)
    if (overId?.startsWith('folder-')) {
      // A collapsed folder should not be a two-step target.
      hoverTimer.current = setTimeout(() => {
        setExpandedItems((current) =>
          current.includes(overId) ? current : [...current, overId]
        )
      }, AUTO_EXPAND_MS)
    }
  }

  const handleDragEnd = (event) => {
    clearTimeout(hoverTimer.current)
    setDragState(null)
    const descriptor = resolveDrop({
      activeId: String(event.active.id),
      overId: event.over ? String(event.over.id) : null,
      tree,
      selectedDocumentIds
    })
    if (!descriptor) return
    if (descriptor.type === 'moveDocuments') {
      runDocumentMove(descriptor.documentIds, descriptor.folderId)
    } else if (descriptor.type === 'moveFolder') {
      const previousParent =
        folders && descriptor.folderId
          ? (function find(list) {
              for (const folder of list) {
                if (folder.folderId === descriptor.folderId) {
                  return folder.parentFolderId ?? null
                }
                const nested = find(folder.children ?? [])
                if (nested !== undefined) return nested
              }
              return undefined
            })(folders)
          : null
      updateFolder(
        descriptor.parentFolderId === null
          ? { folderId: descriptor.folderId, moveToRoot: true }
          : {
              folderId: descriptor.folderId,
              parentFolderId: descriptor.parentFolderId
            },
        {
          onSuccess: () => {
            setUndo({
              message: t('initiativeAgreement:folders.movedFolder'),
              run: () =>
                updateFolder(
                  previousParent === null
                    ? { folderId: descriptor.folderId, moveToRoot: true }
                    : {
                        folderId: descriptor.folderId,
                        parentFolderId: previousParent
                      }
                )
            })
          }
        }
      )
    }
  }

  const commitFileRename = async (documentId, value, currentName) => {
    const next = value.trim()
    setRenamingFileId(null)
    if (!next || next === currentName) return
    try {
      await renameDocument({
        documentID: documentId,
        data: { displayName: next }
      })
    } catch (err) {
      setUploadError(
        err?.response?.data?.detail ||
          err?.message ||
          t('initiativeAgreement:folders.renameFailed')
      )
    }
  }

  const uploadKey = (folderId) => folderId ?? 'root'

  const trackUpload = (folderId, delta) =>
    setUploading((prev) => {
      const key = uploadKey(folderId)
      const next = (prev[key] ?? 0) + delta
      if (next <= 0) {
        const { [key]: _done, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: next }
    })

  // Everything that uploads goes through here: checks the files the way
  // the server will, shows what is in flight, and says why if it fails.
  const uploadFiles = (files, folderId) => {
    const accepted = []
    const rejected = []
    files.forEach((file) => {
      const { isValid, errorMessage } = validateFile(
        file,
        MAX_FILE_SIZE_BYTES,
        DOCUMENT_FILE_TYPES
      )
      if (isValid) accepted.push(file)
      else rejected.push(`${file.name}: ${errorMessage}`)
    })

    if (rejected.length) setUploadError(rejected.join('\n'))
    if (!accepted.length) return

    trackUpload(folderId, accepted.length)
    uploadToFolder(
      { files: accepted, folderId },
      {
        onError: (err) =>
          setUploadError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:folders.uploadFailed')
          ),
        onSettled: () => trackUpload(folderId, -accepted.length)
      }
    )
  }

  const startUploadHere = (folderId) => {
    uploadTargetRef.current = folderId
    uploadInputRef.current?.click()
  }

  const handleUploadInput = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length) {
      uploadFiles(files, uploadTargetRef.current ?? null)
    }
    event.target.value = ''
  }

  const renderFolder = (folder) => (
    <TreeItem
      key={folder.folderId}
      itemId={`folder-${folder.folderId}`}
      label={
        <FolderLabel
          folder={folder}
          invalid={dragState?.invalid?.has(folder.folderId) ?? false}
          renaming={renamingId === folder.folderId}
          onCommitRename={(value) => commitRename(folder.folderId, value)}
          onCancelRename={() => setRenamingId(null)}
          onOpenMenu={(event) => openMenu(event, folder)}
          onStartRename={() => setRenamingId(folder.folderId)}
          onOsFileDrop={(files) => uploadFiles(files, folder.folderId)}
          uploadingCount={uploading[uploadKey(folder.folderId)] ?? 0}
          externalDragSuppressed={!!dragState}
        />
      }
    >
      {folder.children?.map(renderFolder)}
      {folder.documents?.map((file) => (
        <TreeItem
          key={`doc-${file.documentId}`}
          itemId={`doc-${file.documentId}`}
          label={
            <FileLabel
              file={file}
              onDownload={downloadDocument}
              onDelete={(documentId) =>
                setPendingDelete({ documentId, fileName: file.fileName })
              }
              canRename={canRenameFiles}
              renaming={renamingFileId === file.documentId}
              onStartRename={() => setRenamingFileId(file.documentId)}
              onCommitRename={(value) =>
                commitFileRename(
                  file.documentId,
                  value,
                  file.displayName || file.fileName
                )
              }
              onCancelRename={() => setRenamingFileId(null)}
            />
          }
        />
      ))}
      {creating?.parentFolderId === folder.folderId && (
        <TreeItem
          itemId={`new-under-${folder.folderId}`}
          label={
            <NameEditor
              initialValue={t('initiativeAgreement:folders.newFolderName')}
              onCommit={commitCreate}
              onCancel={() => setCreating(null)}
            />
          }
        />
      )}
    </TreeItem>
  )

  const activeDragLabel = () => {
    if (!dragState) return null
    if (dragState.activeId.startsWith('doc-')) {
      const count = selectedDocumentIds.includes(
        Number(dragState.activeId.slice(4))
      )
        ? selectedDocumentIds.length
        : 1
      return t('initiativeAgreement:folders.draggingFiles', { count })
    }
    return t('initiativeAgreement:folders.draggingFolder')
  }

  return (
    <BCBox data-test="document-tree">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <BCTypography
          component="button"
          variant="body4"
          color="link"
          data-test="new-folder-button"
          onClick={() => setCreating({ parentFolderId: null })}
          sx={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          <CreateNewFolderOutlinedIcon fontSize="small" />
          {t('initiativeAgreement:folders.newFolder')}
        </BCTypography>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          clearTimeout(hoverTimer.current)
          setDragState(null)
        }}
      >
        <SimpleTreeView
          multiSelect
          selectedItems={selectedItems}
          onSelectedItemsChange={(_event, items) =>
            setSelectedItems(Array.isArray(items) ? items : [items])
          }
          expandedItems={expandedItems}
          onExpandedItemsChange={(_event, items) => setExpandedItems(items)}
        >
          {folders.map(renderFolder)}
          {creating && creating.parentFolderId === null && (
            <TreeItem
              itemId="new-at-root"
              label={
                <NameEditor
                  initialValue={t('initiativeAgreement:folders.newFolderName')}
                  onCommit={commitCreate}
                  onCancel={() => setCreating(null)}
                />
              }
            />
          )}
          {rootDocuments.map((file) => (
            <TreeItem
              key={`doc-${file.documentId}`}
              itemId={`doc-${file.documentId}`}
              label={
                <FileLabel
                  file={file}
                  onDownload={downloadDocument}
                  onDelete={(documentId) =>
                    setPendingDelete({ documentId, fileName: file.fileName })
                  }
                />
              }
            />
          ))}
        </SimpleTreeView>

        <RootDropZone
          visible={!!dragState}
          label={t('initiativeAgreement:folders.dropToRoot')}
        />

        <DragOverlay>
          {dragState ? (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: 2
              }}
            >
              <BCTypography variant="subtitle2">
                {activeDragLabel()}
              </BCTypography>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!folders.length && !rootDocuments.length && !creating && (
        <BCTypography variant="body4" color="text.secondary">
          {t('initiativeAgreement:folders.empty')}
        </BCTypography>
      )}

      <BCModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        data={{
          title: t('initiativeAgreement:folders.confirmDeleteTitle'),
          primaryButtonText: t('initiativeAgreement:folders.confirmDelete'),
          primaryButtonAction: () => {
            deleteDocument(pendingDelete.documentId)
            setPendingDelete(null)
          },
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <BCTypography variant="body4" data-test="confirm-delete-body">
              {t('initiativeAgreement:folders.confirmDeleteBody', {
                name: pendingDelete?.fileName ?? ''
              })}
            </BCTypography>
          )
        }}
      />

      <DeletedItems parentType={parentType} parentID={parentID} />

      <BCTypography
        variant="body4"
        color="text.secondary"
        component="p"
        sx={{ mt: 1 }}
      >
        {t('initiativeAgreement:folders.helperText')}
      </BCTypography>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        hidden
        data-test="folder-upload-input"
        onChange={handleUploadInput}
      />

      {/* Focus must land on the inline editor a menu action opens, so the
          menu must not yank it back to its anchor on close. */}
      <Menu
        anchorEl={menu?.anchorEl}
        open={!!menu}
        onClose={closeMenu}
        disableRestoreFocus
        dense
        slotProps={{
          paper: { sx: { maxWidth: 260 } }
        }}
        sx={{
          '& .MuiMenuItem-root': { fontSize: '0.875rem', minHeight: 36 },
          '& .MuiListItemIcon-root': { minWidth: 30 },
          '& .MuiTypography-root': { fontSize: '0.875rem' }
        }}
      >
        <MenuItem
          data-test="menu-new-subfolder"
          onClick={() => {
            setCreating({ parentFolderId: menu.folder.folderId })
            closeMenu()
          }}
        >
          <ListItemIcon>
            <CreateNewFolderOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('initiativeAgreement:folders.newSubfolder')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          data-test="menu-upload-here"
          onClick={() => {
            startUploadHere(menu.folder.folderId)
            closeMenu()
          }}
        >
          <ListItemIcon>
            <UploadFileOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('initiativeAgreement:folders.uploadHere')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          data-test="menu-rename"
          onClick={() => {
            setRenamingId(menu.folder.folderId)
            closeMenu()
          }}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('initiativeAgreement:folders.rename')}</ListItemText>
        </MenuItem>
        <MenuItem
          data-test="menu-delete"
          onClick={() => {
            deleteFolder({ folderId: menu.folder.folderId })
            closeMenu()
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('initiativeAgreement:folders.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* A rejected upload is not a passing notice — it means a file the
          user meant to file is not there — so this waits to be dismissed
          rather than timing out. */}
      <Snackbar
        open={!!uploadError}
        onClose={() => setUploadError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        data-test="upload-error-toast"
      >
        <Alert
          severity="error"
          onClose={() => setUploadError('')}
          sx={{ whiteSpace: 'pre-line' }}
        >
          {uploadError}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!undo}
        autoHideDuration={6000}
        onClose={() => setUndo(null)}
        message={undo?.message}
        data-test="move-undo-toast"
        action={
          <Button
            color="secondary"
            size="small"
            data-test="undo-move-button"
            onClick={() => {
              undo?.run()
              setUndo(null)
            }}
          >
            {t('initiativeAgreement:folders.undo')}
          </Button>
        }
      />
    </BCBox>
  )
}

export default DocumentTree
