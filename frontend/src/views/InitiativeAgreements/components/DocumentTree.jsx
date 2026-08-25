import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip
} from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import prettyBytes from 'pretty-bytes'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useDownloadDocument } from '@/hooks/useDocuments'
import {
  useCreateFolder,
  useDeleteFolder,
  useDocumentTree,
  useUpdateFolder
} from '@/hooks/useDocumentFolders'
import { timezoneFormatter } from '@/utils/formatters'

// Folder tree for a designated action's evidence files (#4925, phase 2):
// nested folders with inline create and rename, delete, and the parent's
// unplaced documents at the root. Dragging arrives with phase 3.

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

const FileRow = ({ file, onDownload, government }) => {
  const { t } = useTranslation(['common'])
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}
      data-test={`tree-file-${file.documentId}`}
    >
      <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
      <BCTypography
        component="span"
        variant="subtitle2"
        color="link"
        onClick={(event) => {
          event.stopPropagation()
          onDownload(file.documentId)
        }}
        sx={{
          textDecoration: 'underline',
          cursor: 'pointer',
          '&:hover': { color: 'info.main' }
        }}
      >
        {file.fileName}
      </BCTypography>
      <BCTypography component="span" variant="subtitle2" color="text.secondary">
        {prettyBytes(file.fileSize ?? 0)}
        {' · '}
        {timezoneFormatter({ value: file.createDate })}
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

  // creating: null | { parentFolderId } — an inline editing row.
  const [creating, setCreating] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [menu, setMenu] = useState(null) // { anchorEl, folder }

  if (isLoading) {
    return <Loading message={t('initiativeAgreement:folders.loading')} />
  }

  const folders = tree?.folders ?? []
  const rootDocuments = tree?.rootDocuments ?? []

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

  const renderFolder = (folder) => (
    <TreeItem
      key={folder.folderId}
      itemId={`folder-${folder.folderId}`}
      label={
        renamingId === folder.folderId ? (
          <NameEditor
            initialValue={folder.name}
            onCommit={(value) => commitRename(folder.folderId, value)}
            onCancel={() => setRenamingId(null)}
          />
        ) : (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            data-test={`tree-folder-${folder.folderId}`}
            onDoubleClick={(event) => {
              if (folder.isSystem) return
              event.stopPropagation()
              setRenamingId(folder.folderId)
            }}
          >
            <FolderOutlinedIcon fontSize="small" color="action" />
            <BCTypography component="span" variant="subtitle2">
              {folder.name}
            </BCTypography>
            <BCTypography
              component="span"
              variant="subtitle2"
              color="text.secondary"
            >
              ({folder.documentCount})
            </BCTypography>
            {!folder.isSystem && (
              <IconButton
                size="small"
                data-test={`folder-menu-${folder.folderId}`}
                aria-label={t('initiativeAgreement:folders.folderActions')}
                onClick={(event) => openMenu(event, folder)}
              >
                <MoreVertIcon fontSize="inherit" />
              </IconButton>
            )}
          </Box>
        )
      }
    >
      {folder.children?.map(renderFolder)}
      {folder.documents?.map((file) => (
        <TreeItem
          key={`doc-${file.documentId}`}
          itemId={`doc-${file.documentId}`}
          label={<FileRow file={file} onDownload={downloadDocument} />}
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

      <SimpleTreeView
        defaultExpandedItems={folders.map((f) => `folder-${f.folderId}`)}
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
            label={<FileRow file={file} onDownload={downloadDocument} />}
          />
        ))}
      </SimpleTreeView>

      {!folders.length && !rootDocuments.length && !creating && (
        <BCTypography variant="body4" color="text.secondary">
          {t('initiativeAgreement:folders.empty')}
        </BCTypography>
      )}

      <BCTypography
        variant="body4"
        color="text.secondary"
        component="p"
        sx={{ mt: 1 }}
      >
        {t('initiativeAgreement:folders.helperText')}
      </BCTypography>

      {/* Focus must land on the inline editor a menu action opens, so the
          menu must not yank it back to its anchor on close. */}
      <Menu
        anchorEl={menu?.anchorEl}
        open={!!menu}
        onClose={closeMenu}
        disableRestoreFocus
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
    </BCBox>
  )
}

export default DocumentTree
