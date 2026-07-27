import { inject, nextTick, ref, watch } from 'vue'
import { UserPageEditorKey } from '../context'

const fieldLabels: Record<string, string> = {
  title: '标题',
  description: '描述',
  navVisible: '导航菜单',
  navOrder: '排序权重',
  text: '文本',
  url: '链接',
  label: '文本',
  level: '标题级别',
  target: '目标时间',
  items: '列表',
}

export function useBlockPropertyFocus() {
  const editor = inject(UserPageEditorKey)
  if (!editor) throw new Error('UserPageEditor context is missing')

  const expandedPageSections = ref<Array<string | number>>([])

  watch(() => editor.validationFocusRequest.value?.requestId, async () => {
    const request = editor.validationFocusRequest.value
    if (!request || request.scope === 'settings' || request.pageKey !== editor.currentKey.value) return

    if (request.scope === 'page') {
      const appearanceField = request.fieldPath?.startsWith('theme') || request.fieldPath?.startsWith('background')
      if (editor.currentPage.value.mode === 'block' && appearanceField) return
      const section = request.fieldPath?.startsWith('theme')
        ? 'page-theme'
        : request.fieldPath?.startsWith('background') ? 'page-bg' : 'page-info'
      expandedPageSections.value = [section]
      await nextTick()
      const sectionElement = document.querySelector<HTMLElement>(`.block-property-editor .${section}-section`)
      sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }

    await nextTick()
    const panel = document.querySelector<HTMLElement>('.block-property-editor [data-block-property-editor]')
    if (!panel) return
    const field = request.fieldPath?.split('.').at(-1)?.replace(/\[\d+\]$/, '')
    const label = field ? fieldLabels[field] : null
    const formItem = label
      ? Array.from(panel.querySelectorAll<HTMLElement>('.n-form-item'))
          .find(item => item.querySelector('.n-form-item-label')?.textContent?.includes(label))
      : null
    const target = formItem ?? panel
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    formItem?.querySelector<HTMLElement>('input, textarea, button, [tabindex]')?.focus({ preventScroll: true })
  }, { immediate: true })

  return { expandedPageSections }
}
