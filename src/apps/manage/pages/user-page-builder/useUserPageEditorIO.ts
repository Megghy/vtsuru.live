import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import { createDraftPreview } from '@/apps/user-page/runtime/draftPreview'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/apps/user-page/types'
import type { ComputedRef, Ref } from 'vue'
import { nextTick, ref } from 'vue'
import { deepCloneJson, estimateUtf8Bytes } from './editorHelpers'
import type { UserPageValidationIssue } from './validateUserPagesSettings'

export interface ValidationFocusRequest {
  requestId: number
  pageKey: string
  blockId: string | null
  ancestorLayoutIds: string[]
  fieldPath: string | null
  scope: 'block' | 'page' | 'settings'
}

interface UseUserPageEditorIOOptions {
  settings: Ref<UserPagesSettingsV1>
  currentKey: Ref<string>
  currentPage: Ref<UserPageConfig>
  currentProject: ComputedRef<BlockPageProject | null>
  loadedRollback: Ref<UserPagesSettingsV1 | null>
  accountId: ComputedRef<number>
  accountName: ComputedRef<string>
  selectedBlockIds: Ref<string[]>
  hoveredBlockId: Ref<string | null>
  maxConfigBytes: number
  batchHistory: (fn: () => void) => void
  clearSelection: () => void
  notifySuccess: (content: string) => void
}

function findBlockAncestors(blocks: BlockNode[], blockId: string, ancestors: string[] = []): string[] | null {
  for (const block of blocks) {
    if (block.id === blockId) return ancestors
    if (block.type !== 'layout') continue
    const props = block.props as { children?: BlockNode[] } | undefined
    if (!Array.isArray(props?.children)) continue
    const result = findBlockAncestors(props.children, blockId, [...ancestors, block.id])
    if (result) return result
  }
  return null
}

function parseImportedProject(raw: string) {
  if (raw.trim().length === 0) throw new Error('导入内容为空')
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`JSON 解析失败: ${(error as Error).message || String(error)}`, { cause: error })
  }

  const candidate = parsed && typeof parsed === 'object'
    ? (parsed.type === 'vtsuru-block-page' && parsed.version === 1 ? parsed.project : parsed)
    : null
  if (!candidate) throw new Error('导入内容不是有效的 block page JSON')
  const validation = validateBlockPageProject(candidate)
  if (validation.ok === false) throw new Error(validation.issues.map(issue => issue.message).join('；'))
  return validation.project
}

function assignProject(settings: UserPagesSettingsV1, key: string, project: BlockPageProject) {
  if (key === 'home') {
    settings.home ??= { mode: 'block', block: project }
    settings.home.mode = 'block'
    settings.home.block = project
    return
  }
  settings.pages ??= {}
  settings.pages[key] ??= { mode: 'block', block: project }
  settings.pages[key].mode = 'block'
  settings.pages[key].block = project
}

export function useUserPageEditorIO(options: UseUserPageEditorIOOptions) {
  const validationFocusRequest = ref<ValidationFocusRequest | null>(null)
  let validationFocusRequestId = 0

  function openSettingsPreview(settings: UserPagesSettingsV1) {
    if (!options.accountName.value) return
    const pageKey = options.currentKey.value === 'home' || settings.pages?.[options.currentKey.value]
      ? options.currentKey.value
      : 'home'
    const path = pageKey === 'home'
      ? `/@${options.accountName.value}`
      : `/@${options.accountName.value}/${pageKey}`
    const url = new URL(path, window.location.origin)
    url.searchParams.set('draftPreview', createDraftPreview(options.accountId.value, settings))
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openPreview() {
    openSettingsPreview(options.settings.value)
  }

  function openRollbackPreview() {
    if (options.loadedRollback.value) openSettingsPreview(options.loadedRollback.value)
  }

  function focusValidationIssue(issue: UserPageValidationIssue) {
    const pageKey = issue.pageKey ?? 'home'
    const page = pageKey === 'home' ? options.settings.value.home : options.settings.value.pages?.[pageKey]
    if (issue.scope !== 'settings' && !page) return false
    let ancestorLayoutIds: string[] = []
    if (issue.scope === 'block') {
      if (!issue.blockId || page?.mode !== 'block' || !page.block) return false
      const ancestors = findBlockAncestors(page.block.blocks, issue.blockId)
      if (!ancestors) return false
      ancestorLayoutIds = ancestors
    }
    const requestId = ++validationFocusRequestId
    if (issue.scope !== 'settings') options.currentKey.value = pageKey
    validationFocusRequest.value = {
      requestId,
      pageKey,
      blockId: issue.blockId,
      ancestorLayoutIds,
      fieldPath: issue.fieldPath,
      scope: issue.scope,
    }
    void nextTick(() => {
      if (requestId !== validationFocusRequestId) return
      if (issue.blockId) {
        options.selectedBlockIds.value = [issue.blockId]
        options.hoveredBlockId.value = issue.blockId
      }
    })
    return true
  }

  function exportCurrentBlockPageJson() {
    if (options.currentPage.value.mode !== 'block') throw new Error('当前页面不是区块模式')
    if (!options.currentProject.value) throw new Error('当前页面缺少区块配置')
    return JSON.stringify({
      type: 'vtsuru-block-page' as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      pageKey: options.currentKey.value,
      project: deepCloneJson(options.currentProject.value),
    }, null, 2)
  }

  function importCurrentBlockPageJson(raw: string) {
    if (options.currentPage.value.mode !== 'block') throw new Error('当前页面不是区块模式')
    const project = parseImportedProject(raw)
    const nextSettings = deepCloneJson(options.settings.value)
    assignProject(nextSettings, options.currentKey.value, project)
    const bytes = estimateUtf8Bytes(JSON.stringify(nextSettings))
    if (bytes > options.maxConfigBytes) {
      throw new Error(`导入失败：配置体积超限 ${bytes} / ${options.maxConfigBytes} bytes`)
    }

    options.batchHistory(() => {
      assignProject(options.settings.value, options.currentKey.value, project)
      options.clearSelection()
    })
    options.notifySuccess('已导入区块页面配置')
  }

  return { validationFocusRequest, openPreview, openRollbackPreview, focusValidationIssue, exportCurrentBlockPageJson, importCurrentBlockPageJson }
}
