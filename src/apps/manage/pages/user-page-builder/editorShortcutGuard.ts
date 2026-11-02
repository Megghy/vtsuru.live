export const EDITABLE_OR_EDITOR_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable]:not([contenteditable="false"]), [role="textbox"], .monaco-editor, .code-editor, .w-e-text-container'

const MODAL_CONTAINER_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
const ACTIVE_MODAL_SELECTOR =
  '[role="dialog"]:not([aria-hidden="true"]):not([data-state="closed"]):not([hidden]), [role="alertdialog"]:not([aria-hidden="true"]):not([data-state="closed"]):not([hidden]), [aria-modal="true"]:not([aria-hidden="true"]):not([data-state="closed"]):not([hidden])'
const IGNORED_DELETE_SELECTOR = 'button, a, [role="button"], [role="tab"]'

export interface ShortcutGuardContext {
  isReady: boolean
  hasOpenModal: boolean
}

function resolveDocument(doc?: Document): Document | undefined {
  return doc ?? (typeof document !== 'undefined' ? document : undefined)
}

export function isModalElementActive(el: Element, doc?: Document): boolean {
  if (
    el.getAttribute('aria-hidden') === 'true' ||
    el.getAttribute('data-state') === 'closed' ||
    el.hasAttribute('hidden')
  ) {
    return false
  }

  if (el instanceof HTMLElement) {
    if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.hidden) {
      return false
    }
    const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : undefined)
    if (win?.getComputedStyle) {
      const style = win.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false
      }
    }
  }

  return true
}

function isBlockedElement(target: unknown, doc?: Document): boolean {
  const element = target instanceof Element ? target : (target as Node | null)?.parentElement
  if (!(element instanceof Element)) return false

  if (element.closest(EDITABLE_OR_EDITOR_SELECTOR)) {
    return true
  }

  const modalAncestor = element.closest(MODAL_CONTAINER_SELECTOR)
  if (modalAncestor && isModalElementActive(modalAncestor, doc)) {
    return true
  }

  return false
}

export function isEditorShortcutBlocked(
  event: KeyboardEvent,
  context: ShortcutGuardContext,
  doc?: Document,
): boolean {
  if (!context.isReady || context.hasOpenModal) return true

  const documentRef = resolveDocument(doc)
  if (documentRef) {
    const candidateModals = documentRef.querySelectorAll(ACTIVE_MODAL_SELECTOR)
    for (const modal of candidateModals) {
      if (isModalElementActive(modal, documentRef)) {
        return true
      }
    }
  }

  if (isBlockedElement(event.target, documentRef) || isBlockedElement(documentRef?.activeElement, documentRef)) {
    return true
  }

  if (typeof event.composedPath === 'function') {
    const path = event.composedPath()
    for (const item of path) {
      if (isBlockedElement(item, documentRef)) return true
    }
  }

  return false
}

export function shouldIgnoreDeleteKey(doc?: Document, target?: unknown): boolean {
  const activeEl = resolveDocument(doc)?.activeElement
  if (activeEl instanceof Element && Boolean(activeEl.closest(IGNORED_DELETE_SELECTOR))) {
    return true
  }
  const targetEl = target instanceof Element ? target : (target as Node | null)?.parentElement
  return targetEl instanceof Element && Boolean(targetEl.closest(IGNORED_DELETE_SELECTOR))
}
