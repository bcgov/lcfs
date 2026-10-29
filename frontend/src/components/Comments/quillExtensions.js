import ReactQuill from 'react-quill'

// Toolbar icons and the mention embed for Quill. Quill's registries are
// global, so this module registers them once on import.
const Quill = ReactQuill.Quill
const quillIcons = Quill.import('ui/icons')
quillIcons.attach =
  '<svg viewBox="0 0 24 24" fill="none"><path class="ql-stroke" d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>'
quillIcons.mention =
  '<svg viewBox="0 0 24 24" fill="none"><circle class="ql-stroke" cx="12" cy="12" r="4"/><path class="ql-stroke" d="M16 8v5a3 3 0 0 0 6 0v-1a10 9 0 1 0-4.75 8.47"/></svg>'

// Inline embed for a mention: <span class="mention" data-mention-id="42">.
// Some tests mock react-quill, where `blots/embed` isn't a class; in that case
// the blot is skipped and mentions fall back to plain "@Name" text.
const MentionEmbedBase = Quill.import('blots/embed')
export let mentionBlotRegistered = false
if (typeof MentionEmbedBase === 'function') {
  class MentionBlot extends MentionEmbedBase {
    static create(data) {
      const node = super.create()
      node.setAttribute('data-mention-id', data.id)
      node.setAttribute('data-mention-name', data.name)
      node.setAttribute('contenteditable', 'false')
      node.textContent = `@${data.name}`
      return node
    }

    static value(node) {
      return {
        id: node.getAttribute('data-mention-id'),
        name: node.getAttribute('data-mention-name')
      }
    }
  }
  MentionBlot.blotName = 'mention'
  MentionBlot.tagName = 'span'
  MentionBlot.className = 'mention'
  Quill.register(MentionBlot)
  mentionBlotRegistered = true
}
