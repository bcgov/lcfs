// Pure logic for the folder tree's drag and drop (#4925, phase 3).
// Kept free of React so the interesting decisions — what a drop means,
// which targets are legal, how the tree transforms optimistically — are
// unit-testable without simulating pointer gestures.

export const DOC_PREFIX = 'doc-'
export const FOLDER_PREFIX = 'folder-'
export const ROOT_DROP_ID = 'root'

export const docDragId = (documentId) => `${DOC_PREFIX}${documentId}`
export const folderDragId = (folderId) => `${FOLDER_PREFIX}${folderId}`

const parseId = (id) => {
  if (id === ROOT_DROP_ID) return { kind: 'root' }
  if (String(id).startsWith(DOC_PREFIX)) {
    return { kind: 'doc', id: Number(String(id).slice(DOC_PREFIX.length)) }
  }
  if (String(id).startsWith(FOLDER_PREFIX)) {
    return {
      kind: 'folder',
      id: Number(String(id).slice(FOLDER_PREFIX.length))
    }
  }
  return { kind: 'unknown' }
}

export const flattenFolders = (folders, acc = []) => {
  for (const folder of folders ?? []) {
    acc.push(folder)
    flattenFolders(folder.children, acc)
  }
  return acc
}

export const collectDescendantFolderIds = (folders, folderId) => {
  const byParent = new Map()
  for (const folder of flattenFolders(folders)) {
    const key = folder.parentFolderId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(folder.folderId)
  }
  const result = new Set()
  const frontier = [folderId]
  while (frontier.length) {
    const current = frontier.pop()
    for (const child of byParent.get(current) ?? []) {
      result.add(child)
      frontier.push(child)
    }
  }
  return result
}

export const findFolderOfDocument = (tree, documentId) => {
  for (const folder of flattenFolders(tree?.folders)) {
    if (folder.documents?.some((d) => d.documentId === documentId)) {
      return folder.folderId
    }
  }
  return null
}

/**
 * Translate a finished drag into a mutation descriptor, or null when the
 * drop changes nothing or is illegal (a folder into itself or its own
 * subtree). selectedDocumentIds lets a multi-selection travel as one unit
 * when the dragged file is part of it.
 */
export const resolveDrop = ({
  activeId,
  overId,
  tree,
  selectedDocumentIds = []
}) => {
  if (!overId) return null
  const active = parseId(activeId)
  const over = parseId(overId)
  const targetFolderId =
    over.kind === 'root' ? null : over.kind === 'folder' ? over.id : null
  if (over.kind === 'doc' || over.kind === 'unknown') return null

  if (active.kind === 'doc') {
    const documentIds = selectedDocumentIds.includes(active.id)
      ? selectedDocumentIds
      : [active.id]
    const unmoved = documentIds.every(
      (id) => findFolderOfDocument(tree, id) === targetFolderId
    )
    if (unmoved) return null
    return { type: 'moveDocuments', documentIds, folderId: targetFolderId }
  }

  if (active.kind === 'folder') {
    if (targetFolderId === active.id) return null
    if (
      targetFolderId !== null &&
      collectDescendantFolderIds(tree?.folders, active.id).has(targetFolderId)
    ) {
      return null
    }
    const current = flattenFolders(tree?.folders).find(
      (f) => f.folderId === active.id
    )
    if ((current?.parentFolderId ?? null) === targetFolderId) return null
    return {
      type: 'moveFolder',
      folderId: active.id,
      parentFolderId: targetFolderId
    }
  }

  return null
}

const rebuild = (flat, rootDocuments) => {
  const nodes = new Map()
  for (const folder of flat) {
    nodes.set(folder.folderId, { ...folder, children: [], documentCount: 0 })
  }
  const roots = []
  for (const folder of flat) {
    const node = nodes.get(folder.folderId)
    const parent =
      folder.parentFolderId != null ? nodes.get(folder.parentFolderId) : null
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const rollup = (node) => {
    node.documentCount =
      (node.documents?.length ?? 0) +
      node.children.reduce((sum, child) => sum + rollup(child), 0)
    return node.documentCount
  }
  roots.forEach(rollup)
  return { folders: roots, rootDocuments }
}

/** Optimistic transform: move documents into a folder (or root: null). */
export const applyDocumentMove = (tree, documentIds, folderId) => {
  const moving = new Set(documentIds)
  const moved = []
  const flat = flattenFolders(tree?.folders).map((folder) => {
    const kept = []
    for (const doc of folder.documents ?? []) {
      if (moving.has(doc.documentId)) {
        moved.push(doc)
      } else {
        kept.push(doc)
      }
    }
    return { ...folder, documents: kept }
  })
  const rootKept = []
  for (const doc of tree?.rootDocuments ?? []) {
    if (moving.has(doc.documentId)) {
      moved.push(doc)
    } else {
      rootKept.push(doc)
    }
  }
  if (folderId === null) {
    return rebuild(flat, [...rootKept, ...moved])
  }
  const withTarget = flat.map((folder) =>
    folder.folderId === folderId
      ? { ...folder, documents: [...folder.documents, ...moved] }
      : folder
  )
  return rebuild(withTarget, rootKept)
}

/** Optimistic transform: reparent a folder (parentFolderId null = root). */
export const applyFolderMove = (tree, folderId, parentFolderId) => {
  const flat = flattenFolders(tree?.folders).map((folder) =>
    folder.folderId === folderId ? { ...folder, parentFolderId } : folder
  )
  return rebuild(flat, tree?.rootDocuments ?? [])
}

/** The inverse moves needed to undo a document move, grouped by the
 * folder each document previously sat in. */
export const invertDocumentMove = (treeBefore, documentIds) => {
  const groups = new Map()
  for (const documentId of documentIds) {
    const from = findFolderOfDocument(treeBefore, documentId)
    const key = from ?? 'root'
    if (!groups.has(key)) groups.set(key, { folderId: from, documentIds: [] })
    groups.get(key).documentIds.push(documentId)
  }
  return [...groups.values()]
}
