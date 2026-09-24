import { describe, expect, it } from 'vitest'
import {
  applyDocumentMove,
  applyFolderMove,
  collectDescendantFolderIds,
  findFolderOfDocument,
  invertDocumentMove,
  resolveDrop
} from '../documentTreeDnd'

const doc = (documentId, fileName = `${documentId}.pdf`) => ({
  documentId,
  fileName,
  fileSize: 1,
  createDate: null,
  createUser: null
})

const tree = {
  folders: [
    {
      folderId: 1,
      name: 'Top',
      parentFolderId: null,
      sortOrder: 0,
      isSystem: false,
      documentCount: 2,
      documents: [doc(10)],
      children: [
        {
          folderId: 2,
          name: 'Middle',
          parentFolderId: 1,
          sortOrder: 0,
          isSystem: false,
          documentCount: 1,
          documents: [doc(11)],
          children: []
        }
      ]
    },
    {
      folderId: 3,
      name: 'Other',
      parentFolderId: null,
      sortOrder: 0,
      isSystem: false,
      documentCount: 0,
      documents: [],
      children: []
    }
  ],
  rootDocuments: [doc(12)]
}

describe('documentTreeDnd', () => {
  it('collects descendants of a folder', () => {
    expect(collectDescendantFolderIds(tree.folders, 1)).toEqual(new Set([2]))
    expect(collectDescendantFolderIds(tree.folders, 3)).toEqual(new Set())
  })

  it('finds the folder a document sits in', () => {
    expect(findFolderOfDocument(tree, 11)).toBe(2)
    expect(findFolderOfDocument(tree, 12)).toBeNull()
  })

  it('resolves a file dropped on a folder', () => {
    expect(
      resolveDrop({ activeId: 'doc-12', overId: 'folder-2', tree })
    ).toEqual({ type: 'moveDocuments', documentIds: [12], folderId: 2 })
  })

  it('drags a multi-selection as one unit when the dragged file is in it', () => {
    expect(
      resolveDrop({
        activeId: 'doc-10',
        overId: 'folder-3',
        tree,
        selectedDocumentIds: [10, 12]
      })
    ).toEqual({ type: 'moveDocuments', documentIds: [10, 12], folderId: 3 })

    // A drag of an unselected file ignores the selection.
    expect(
      resolveDrop({
        activeId: 'doc-11',
        overId: 'folder-3',
        tree,
        selectedDocumentIds: [10, 12]
      })
    ).toEqual({ type: 'moveDocuments', documentIds: [11], folderId: 3 })
  })

  it('resolves a file dropped on the root zone', () => {
    expect(resolveDrop({ activeId: 'doc-11', overId: 'root', tree })).toEqual({
      type: 'moveDocuments',
      documentIds: [11],
      folderId: null
    })
  })

  it('ignores a drop that changes nothing', () => {
    expect(resolveDrop({ activeId: 'doc-12', overId: 'root', tree })).toBeNull()
    expect(
      resolveDrop({ activeId: 'doc-11', overId: 'folder-2', tree })
    ).toBeNull()
  })

  it('resolves a folder move and refuses cycles', () => {
    expect(
      resolveDrop({ activeId: 'folder-2', overId: 'folder-3', tree })
    ).toEqual({ type: 'moveFolder', folderId: 2, parentFolderId: 3 })
    expect(resolveDrop({ activeId: 'folder-2', overId: 'root', tree })).toEqual(
      { type: 'moveFolder', folderId: 2, parentFolderId: null }
    )
    // Into itself or its own subtree: refused.
    expect(
      resolveDrop({ activeId: 'folder-1', overId: 'folder-2', tree })
    ).toBeNull()
    expect(
      resolveDrop({ activeId: 'folder-1', overId: 'folder-1', tree })
    ).toBeNull()
    // Into its current parent: nothing changes.
    expect(
      resolveDrop({ activeId: 'folder-2', overId: 'folder-1', tree })
    ).toBeNull()
  })

  it('applies a document move optimistically with recomputed counts', () => {
    const next = applyDocumentMove(tree, [12], 2)
    const top = next.folders.find((f) => f.folderId === 1)
    const middle = top.children[0]
    expect(middle.documents.map((d) => d.documentId)).toEqual([11, 12])
    expect(middle.documentCount).toBe(2)
    expect(top.documentCount).toBe(3)
    expect(next.rootDocuments).toEqual([])
  })

  it('applies a move to root optimistically', () => {
    const next = applyDocumentMove(tree, [11], null)
    const top = next.folders.find((f) => f.folderId === 1)
    expect(top.children[0].documents).toEqual([])
    expect(top.documentCount).toBe(1)
    expect(next.rootDocuments.map((d) => d.documentId)).toEqual([12, 11])
  })

  it('applies a folder move optimistically', () => {
    const next = applyFolderMove(tree, 2, 3)
    const top = next.folders.find((f) => f.folderId === 1)
    const other = next.folders.find((f) => f.folderId === 3)
    expect(top.children).toEqual([])
    expect(other.children.map((f) => f.folderId)).toEqual([2])
    expect(other.documentCount).toBe(1)
    expect(top.documentCount).toBe(1)
  })

  it('inverts a move back to each previous folder', () => {
    expect(invertDocumentMove(tree, [10, 11, 12])).toEqual([
      { folderId: 1, documentIds: [10] },
      { folderId: 2, documentIds: [11] },
      { folderId: null, documentIds: [12] }
    ])
  })
})
