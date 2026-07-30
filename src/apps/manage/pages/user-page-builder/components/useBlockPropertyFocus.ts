import { inject, nextTick, ref, watch } from 'vue'

import { UserPageEditorKey } from '../context'

export function useBlockPropertyFocus() {
  const editor = inject(UserPageEditorKey)
  if (!editor) throw new Error('UserPageEditor context is missing')

  const expandedPageSections = ref<Array<string | number>>([])

  watch(
    () => editor.validationFocusRequest.value?.requestId,
    async () => {
      const request = editor.validationFocusRequest.value
      if (!request || request.scope === 'settings' || request.pageKey !== editor.currentKey.value) return

      if (request.scope === 'page') {
        const appearanceField = request.fieldPath?.startsWith('theme') || request.fieldPath?.startsWith('background')
        if (editor.currentPage.value.mode === 'block' && appearanceField) return
        const section = request.fieldPath?.startsWith('theme')
          ? 'page-theme'
          : request.fieldPath?.startsWith('background')
            ? 'page-bg'
            : 'page-info'
        expandedPageSections.value = [section]
        await nextTick()
        const sectionElement = document.querySelector<HTMLElement>(`.block-property-editor .${section}-section`)
        sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }

      await nextTick()
      const panel = document.querySelector<HTMLElement>('.block-property-editor [data-block-property-editor]')
      if (!panel) return
      const field = request.fieldPath
      const fieldElement = field
        ? panel.querySelector<HTMLElement>(`[data-validation-field="${CSS.escape(field)}"]`)
        : null
      const target = fieldElement ?? panel
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      target.querySelector<HTMLElement>('input, textarea, button, [tabindex]')?.focus({ preventScroll: true })
    },
    { immediate: true },
  )

  return { expandedPageSections }
}
