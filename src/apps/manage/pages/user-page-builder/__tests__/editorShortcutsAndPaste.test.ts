import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { BlockPageProject } from '@/apps/user-page/block/schema'

import { isEditorShortcutBlocked, shouldIgnoreDeleteKey } from '../editorShortcutGuard'
import { useUserPageBlocks } from '../useUserPageBlocks'

describe('editor blocks clipboard and paste feedback', () => {
  it('gives clear notification when pasting with empty block clipboard', () => {
    const notifyWarning = vi.fn()
    const notifySuccess = vi.fn()

    const project = ref<BlockPageProject>({
      version: 1,
      blocks: [],
    })

    const blocksApi = useUserPageBlocks({
      currentProject: computed(() => project.value),
      selectedBlockIds: ref<string[]>([]),
      history: {
        batch: (fn: () => void) => fn(),
      },
      notify: {
        success: notifySuccess,
        warning: notifyWarning,
      },
    })

    const pasted = blocksApi.pasteBlocksAfter(null)

    expect(pasted).toBe(false)
    expect(notifyWarning).toHaveBeenCalledWith('区块剪贴板为空，请先复制区块')
    expect(notifySuccess).not.toHaveBeenCalled()
  })

  it('clears clipboard when copying empty or non-existent blockIds', () => {
    const notifyWarning = vi.fn()
    const notifySuccess = vi.fn()

    const project = ref<BlockPageProject>({
      version: 1,
      blocks: [{ id: 'b1', type: 'customHtml', props: {} }],
    })

    const blocksApi = useUserPageBlocks({
      currentProject: computed(() => project.value),
      selectedBlockIds: ref<string[]>([]),
      history: {
        batch: (fn: () => void) => fn(),
      },
      notify: {
        success: notifySuccess,
        warning: notifyWarning,
      },
    })

    // First populate clipboard
    expect(blocksApi.copyBlocksToClipboard(['b1'])).toBe(true)
    expect(notifySuccess).toHaveBeenCalledWith('已复制 1 个区块')
    expect(blocksApi.pasteBlocksAfter(null)).toBe(true)

    // Now copy invalid ID: should reset clipboard and prevent subsequent paste
    notifySuccess.mockClear()
    notifyWarning.mockClear()
    expect(blocksApi.copyBlocksToClipboard(['non-existent'])).toBe(false)
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(blocksApi.pasteBlocksAfter(null)).toBe(false)
    expect(notifyWarning).toHaveBeenCalledWith('区块剪贴板为空，请先复制区块')

    // Empty list copy should also return false
    expect(blocksApi.copyBlocksToClipboard([])).toBe(false)
  })

  it('allows pasting after copying blocks', () => {
    const notifyWarning = vi.fn()
    const notifySuccess = vi.fn()

    const project = ref<BlockPageProject>({
      version: 1,
      blocks: [{ id: 'b1', type: 'customHtml', props: {} }],
    })
    const selectedBlockIds = ref<string[]>(['b1'])

    const blocksApi = useUserPageBlocks({
      currentProject: computed(() => project.value),
      selectedBlockIds,
      history: {
        batch: (fn: () => void) => fn(),
      },
      notify: {
        success: notifySuccess,
        warning: notifyWarning,
      },
    })

    blocksApi.copyBlocksToClipboard(['b1'])
    expect(notifySuccess).toHaveBeenCalledWith('已复制 1 个区块')

    const pasted = blocksApi.pasteBlocksAfter('b1')
    expect(pasted).toBe(true)
    expect(notifySuccess).toHaveBeenCalledWith('已粘贴 1 个区块')
    expect(project.value.blocks.length).toBe(2)
    expect(project.value.blocks[1].id).not.toBe('b1')
  })
})
describe('editor shortcut guard', () => {
  it('blocks shortcuts when editor is not ready or modal is open', () => {
    const dummyEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })

    expect(isEditorShortcutBlocked(dummyEvent, { isReady: false, hasOpenModal: false })).toBe(true)
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: true })).toBe(true)
  })

  it('blocks shortcuts when a dialog is present in document', () => {
    const doc = document.implementation.createHTMLDocument('test')
    const dialog = doc.createElement('div')
    dialog.setAttribute('role', 'dialog')
    doc.body.appendChild(dialog)

    const dummyEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(true)
  })

  it('does not block shortcuts when dialog is closed or hidden', () => {
    const doc = document.implementation.createHTMLDocument('test')
    const closedDialog = doc.createElement('div')
    closedDialog.setAttribute('role', 'dialog')
    closedDialog.setAttribute('data-state', 'closed')
    doc.body.appendChild(closedDialog)

    const canvas = doc.createElement('div')
    canvas.className = 'user-page-canvas'
    doc.body.appendChild(canvas)

    const dummyEvent = { target: canvas } as unknown as KeyboardEvent
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(false)

    closedDialog.removeAttribute('data-state')
    closedDialog.setAttribute('aria-hidden', 'true')
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(false)

    closedDialog.removeAttribute('aria-hidden')
    closedDialog.style.display = 'none'
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(false)

    closedDialog.style.display = ''
    closedDialog.style.visibility = 'hidden'
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(false)
  })

  it('blocks shortcuts for alertdialog role', () => {
    const doc = document.implementation.createHTMLDocument('test')
    const alertDialog = doc.createElement('div')
    alertDialog.setAttribute('role', 'alertdialog')
    doc.body.appendChild(alertDialog)

    const canvas = doc.createElement('div')
    doc.body.appendChild(canvas)

    const dummyEvent = { target: canvas } as unknown as KeyboardEvent
    expect(isEditorShortcutBlocked(dummyEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(true)
  })

  it('blocks shortcuts when event target or activeElement is editable or code editor', () => {
    const doc = document.implementation.createHTMLDocument('test')
    const container = doc.createElement('div')
    container.className = 'monaco-editor'
    const textarea = doc.createElement('textarea')
    container.appendChild(textarea)
    doc.body.appendChild(container)

    const targetEvent = {
      target: textarea,
    } as unknown as KeyboardEvent

    expect(isEditorShortcutBlocked(targetEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(true)
  })

  it('allows shortcuts on plain canvas background when ready and idle', () => {
    const doc = document.implementation.createHTMLDocument('test')
    const canvas = doc.createElement('div')
    canvas.className = 'user-page-canvas'
    doc.body.appendChild(canvas)

    const targetEvent = {
      target: canvas,
    } as unknown as KeyboardEvent

    expect(isEditorShortcutBlocked(targetEvent, { isReady: true, hasOpenModal: false }, doc)).toBe(false)
  })

  it('ignores delete key when focus is on a button or link', () => {
    const doc = document.implementation.createHTMLDocument('test')
    const button = doc.createElement('button')
    doc.body.appendChild(button)
    Object.defineProperty(doc, 'activeElement', { value: button, configurable: true })

    expect(shouldIgnoreDeleteKey(doc)).toBe(true)

    const plainDiv = doc.createElement('div')
    doc.body.appendChild(plainDiv)
    Object.defineProperty(doc, 'activeElement', { value: plainDiv, configurable: true })
    expect(shouldIgnoreDeleteKey(doc)).toBe(false)

    // When target is a button, it should also be ignored
    expect(shouldIgnoreDeleteKey(doc, button)).toBe(true)
  })
})
