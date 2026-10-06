import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getMentionOptionId,
  MENTION_LISTBOX_ID,
  parseMentionTrigger
} from './mentionUtils'
import { mentionBlotRegistered } from './quillExtensions'

// How far back from the caret to look for an "@query".
const TRIGGER_LOOKBACK = 60
const EMPTY_RECT = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0
}
const NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape']

// Scrolls only the options list. `scrollIntoView` would also scroll the page.
const scrollOptionIntoView = (index) => {
  const option = document.getElementById(getMentionOptionId(index))
  const list = document.getElementById(MENTION_LISTBOX_ID)
  if (!option || !list) return
  const optionRect = option.getBoundingClientRect()
  const listRect = list.getBoundingClientRect()
  if (optionRect.top < listRect.top) {
    list.scrollTop -= listRect.top - optionRect.top
  } else if (optionRect.bottom > listRect.bottom) {
    list.scrollTop += optionRect.bottom - listRect.bottom
  }
}

/**
 * @mention behaviour for a Quill editor: detects "@query" at the caret, tracks
 * the dropdown state and inserts the chosen user as a mention.
 *
 * The user lookup itself is owned by the parent (`onQueryChange` / `results`),
 * so this hook needs no API or auth context.
 */
export const useMentionEditor = ({
  quillRef,
  enabled,
  results,
  onQueryChange
}) => {
  // Non-null while a lookup is open: { anchorIndex, query, activeIndex }
  const [mention, setMention] = useState(null)
  const users = useMemo(() => results.data || [], [results.data])

  // Read by the toolbar handler, which must keep a stable identity.
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const getQuill = useCallback(
    () => quillRef.current?.getEditor?.(),
    [quillRef]
  )
  const closeMention = useCallback(() => setMention(null), [])
  const setActiveIndex = useCallback(
    (activeIndex) =>
      setMention((prev) => (prev ? { ...prev, activeIndex } : prev)),
    []
  )

  const openMention = useCallback((anchorIndex, query) => {
    setMention((prev) => ({
      anchorIndex,
      query,
      activeIndex:
        prev && prev.anchorIndex === anchorIndex ? prev.activeIndex : 0
    }))
  }, [])

  // Viewport rect of the "@", read on demand so the dropdown follows the page
  // when it scrolls.
  const anchorIndex = mention?.anchorIndex
  const getAnchorRect = useCallback(() => {
    const quill = getQuill()
    if (!quill || anchorIndex === undefined) return EMPTY_RECT
    const bounds = quill.getBounds(anchorIndex, 0)
    const root = quill.root.getBoundingClientRect()
    const left = root.left + bounds.left
    const top = root.top + bounds.top
    const height = bounds.height || 20
    return {
      x: left,
      y: top,
      left,
      top,
      right: left,
      bottom: top + height,
      width: 0,
      height
    }
  }, [getQuill, anchorIndex])

  // Call from the editor's onChange to open, update or close the dropdown.
  const handleEditorChange = useCallback(
    (editor) => {
      if (!enabled) return
      const selection = editor.getSelection()
      if (!selection || selection.length > 0) {
        closeMention()
        return
      }
      const start = Math.max(0, selection.index - TRIGGER_LOOKBACK)
      // Not `getText()`: it omits embeds, which would shift every index after
      // an existing mention. Count each embed as one character instead.
      const textBefore = editor
        .getContents(start, selection.index - start)
        .ops.map((op) => (typeof op.insert === 'string' ? op.insert : '\uFFFC'))
        .join('')
      const trigger = parseMentionTrigger(textBefore)
      if (!trigger) {
        closeMention()
        return
      }
      openMention(start + trigger.anchorIndex, trigger.query)
    },
    [enabled, closeMention, openMention]
  )

  // Caret moved or the editor lost focus: re-evaluate, or close the dropdown.
  const handleSelectionChange = useCallback(
    (range, _source, editor) => {
      if (range) handleEditorChange(editor)
      else closeMention()
    },
    [handleEditorChange, closeMention]
  )

  const selectMention = useCallback(
    (user) => {
      const quill = getQuill()
      if (!quill || !mention) return
      const { anchorIndex, query } = mention
      const caret =
        quill.getSelection()?.index ?? anchorIndex + 1 + query.length
      quill.deleteText(anchorIndex, Math.max(caret - anchorIndex, 0), 'user')
      if (mentionBlotRegistered) {
        quill.insertEmbed(
          anchorIndex,
          'mention',
          { id: user.userProfileId, name: user.displayName },
          'user'
        )
        quill.insertText(anchorIndex + 1, ' ', 'user')
        quill.setSelection(anchorIndex + 2, 0, 'user')
      } else {
        const text = `@${user.displayName} `
        quill.insertText(anchorIndex, text, 'user')
        quill.setSelection(anchorIndex + text.length, 0, 'user')
      }
      closeMention()
    },
    [mention, closeMention, getQuill]
  )

  // Toolbar "@" button: inserts "@" at the caret (or the end) and opens the
  // dropdown. Stable identity, so it can live in Quill's `modules` config.
  const handleButtonClick = useCallback(() => {
    if (!enabledRef.current) return
    const quill = getQuill()
    if (!quill) return
    const hadFocus = quill.hasFocus()
    const prior = quill.getSelection()
    quill.focus()
    const caret =
      hadFocus && prior ? prior.index : Math.max(quill.getLength() - 1, 0)
    const previousChar = caret > 0 ? quill.getText(caret - 1, 1) : ''
    const text = previousChar && !/\s/.test(previousChar) ? ' @' : '@'
    quill.insertText(caret, text, 'user')
    const anchorIndex = caret + text.length - 1
    quill.setSelection(anchorIndex + 1, 0, 'user')
    openMention(anchorIndex, '')
  }, [openMention, getQuill])

  useEffect(() => {
    if (enabled) onQueryChange(mention?.query ?? null)
  }, [enabled, mention, onQueryChange])

  // Keep the highlighted row valid when the result list shrinks.
  useEffect(() => {
    if (mention && users.length > 0 && mention.activeIndex >= users.length) {
      setActiveIndex(users.length - 1)
    }
  }, [mention, users, setActiveIndex])

  // Arrow/Enter/Tab/Escape handling. Registered on `document` in the capture
  // phase so it runs before Quill's own key bindings.
  useEffect(() => {
    const container = getQuill()?.container
    if (!enabled || !mention || !container) return undefined

    // The editor and its toolbar count, as does "nothing focused": clicking
    // the toolbar "@" can leave focus on the button or on <body>.
    const toolbar = getQuill()?.getModule('toolbar')?.container
    const isInScope = (target) =>
      container.contains(target) ||
      !!toolbar?.contains(target) ||
      target === document.body

    const onKeyDown = (event) => {
      if (!isInScope(event.target) || !NAVIGATION_KEYS.includes(event.key)) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMention()
        return
      }
      const isArrow = event.key === 'ArrowDown' || event.key === 'ArrowUp'

      if (users.length === 0) {
        // While results are loading (or there are none), arrows must not
        // scroll the page and Enter/Tab must not act on a half-open list.
        if (isArrow || results.isFetching) {
          event.preventDefault()
          event.stopPropagation()
        }
        return
      }

      if (isArrow) {
        event.preventDefault()
        event.stopPropagation()
        const step = event.key === 'ArrowDown' ? 1 : -1
        const next = (mention.activeIndex + step + users.length) % users.length
        setActiveIndex(next)
        requestAnimationFrame(() => scrollOptionIntoView(next))
        return
      }

      // Enter / Tab: clamp because the result list may have just shrunk.
      const user = users[Math.min(mention.activeIndex, users.length - 1)]
      if (user) {
        event.preventDefault()
        event.stopPropagation()
        selectMention(user)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [
    enabled,
    mention,
    users,
    results.isFetching,
    selectMention,
    closeMention,
    setActiveIndex,
    getQuill
  ])

  // Expose the open/active state to screen readers as a combobox.
  useEffect(() => {
    const root = getQuill()?.root
    if (!root) return
    if (mention) {
      root.setAttribute('aria-expanded', 'true')
      root.setAttribute('aria-owns', MENTION_LISTBOX_ID)
      root.setAttribute(
        'aria-activedescendant',
        getMentionOptionId(mention.activeIndex)
      )
    } else {
      root.removeAttribute('aria-expanded')
      root.removeAttribute('aria-owns')
      root.removeAttribute('aria-activedescendant')
    }
  }, [mention, getQuill])

  return {
    mention,
    users,
    getAnchorRect,
    setActiveIndex,
    selectMention,
    handleEditorChange,
    handleSelectionChange,
    handleButtonClick
  }
}
