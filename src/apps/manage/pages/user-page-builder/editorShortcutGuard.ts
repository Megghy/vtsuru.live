export const EDITABLE_OR_EDITOR_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="textbox"], .monaco-editor, .code-editor, .w-e-text-container'

const BLOCKED_TARGET_SELECTOR = `${EDITABLE_OR_EDITOR_SELECTOR}, [role="dialog"]`
const IGNORED_DELETE_SELECTOR = 'button, a, [role="button"], [role="tab"]'

export interface ShortcutGuardContext {
  isReady: boolean
  hasOpenModal: boolean
}

function resolveDocument(doc?: Document): Document | undefined {
  return doc ?? (typeof document !== 'undefined' ? document : undefined)
}

function isBlockedElement(target: unknown): boolean {
  return target instanceof Element && Boolean(target.closest(BLOCKED_TARGET_SELECTOR))
}

export function isEditorShortcutBlocked(
  event: KeyboardEvent,
  context: ShortcutGuardContext,
  doc?: Document,
): boolean {
  if (!context.isReady || context.hasOpenModal) return true

  const documentRef = resolveDocument(doc)
  if (documentRef?.querySelector('[role="dialog"], [aria-modal="true"]')) {
    return true
  }

  return isBlockedElement(event.target) || isBlockedElement(documentRef?.activeElement)
}

export function shouldIgnoreDeleteKey(doc?: Document): boolean {
  const activeEl = resolveDocument(doc)?.activeElement
  return activeEl instanceof Element && Boolean(activeEl.closest(IGNORED_DELETE_SELECTOR))
}
