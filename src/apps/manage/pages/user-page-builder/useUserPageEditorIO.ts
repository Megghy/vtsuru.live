import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import { createDraftPreview } from '@/apps/user-page/runtime/draftPreview'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/apps/user-page/types'
import type { ComputedRef, Ref } from 'vue'
import { nextTick, ref } from 'vue'
import { deepCloneJson, estimateUtf8Bytes } from './editorHelpers'

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
  accountId: ComputedRef<number>
  accountName: ComputedRef<string>
  selectedBlockIds: Ref<string[]>
  hoveredBlockId: Ref<string | null>
  maxConfigBytes: number
  batchHistory: (fn: () => void) => void
  clearSelection: () => void
  notifySuccess: (content: string) => void
}

function findBlockFromValidationPath(project: BlockPageProject, errorMessage: string) {
  const indices = Array.from(errorMessage.matchAll(/(?:blocks|children)\[(\d+)\]/g), match => Number(match[1]))
  if (!indices.length) return null
  let blocks = project.blocks
  const ancestorLayoutIds: string[] = []
  let target: BlockNode | null = null
  for (const [position, index] of indices.entries()) {
    const candidate = blocks[index]
    if (!candidate) return null
    target = candidate
    if (position === indices.length - 1) break
    if (target.type !== 'layout' || !Array.isArray((target.props as any)?.children)) return null
    if (target.id) ancestorLayoutIds.push(target.id)
    blocks = (target.props as any).children
  }
  if (!target?.id) return null
  return { target, ancestorLayoutIds }
}

function extractFieldPath(detail: string) {
  const fields = detail
    .split(/:\s*/)
    .map(segment => segment.match(/^([a-z]\w*(?:\[\d+\])?(?:\.[a-z]\w*(?:\[\d+\])?)*)/i)?.[1] ?? null)
    .filter((field): field is string => !!field && !field.startsWith('blocks') && !field.startsWith('children'))
  if (fields.length) return fields.join('.')
  if (detail.includes('缺少 props') || detail.includes('props 必须')) return 'props'
  if (detail.includes('block type') || detail.includes('type 不能为空')) return 'type'
  if (detail.includes('一级标题')) return 'level'
  if (detail.includes('layout 嵌套过深')) return 'children'
  return null
}

function parseValidationTarget(settings: UserPagesSettingsV1, errorMessage: string) {
  const prefix = errorMessage.match(/^(settings|home|pages\.([^:]+)):(.*)$/)
  if (!prefix) return null
  const pageLabel = prefix[1]
  const detail = prefix[3].trimStart()
  if (pageLabel === 'settings') {
    const fieldPath = extractFieldPath(detail)
    if (!fieldPath || !/^(?:theme|background)(?:\.|$)/.test(fieldPath)) return null
    return { pageKey: 'home', blockId: null, ancestorLayoutIds: [], fieldPath, scope: 'settings' as const }
  }

  const pageKey = pageLabel === 'home' ? 'home' : prefix[2]
  const page = pageKey === 'home' ? settings.home : settings.pages?.[pageKey]
  if (!pageKey || !page) return null
  const pathMatch = detail.match(/blocks\[\d+\](?:\.children\[\d+\])*/)
  if (!pathMatch) {
    return { pageKey, blockId: null, ancestorLayoutIds: [], fieldPath: extractFieldPath(detail), scope: 'page' as const }
  }
  if (page.mode !== 'block' || !page.block) return null
  const blockTarget = findBlockFromValidationPath(page.block, pathMatch[0])
  if (!blockTarget) return null
  return {
    pageKey,
    blockId: blockTarget.target.id,
    ancestorLayoutIds: blockTarget.ancestorLayoutIds,
    fieldPath: extractFieldPath(detail.slice((pathMatch.index ?? 0) + pathMatch[0].length)),
    scope: 'block' as const,
  }
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
  if (validation.ok === false) throw new Error(validation.errors.join('；'))
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

  function openPreview() {
    if (!options.accountName.value) return
    const path = options.currentKey.value === 'home'
      ? `/@${options.accountName.value}`
      : `/@${options.accountName.value}/${options.currentKey.value}`
    const url = new URL(path, window.location.origin)
    url.searchParams.set('draftPreview', createDraftPreview(options.accountId.value, options.settings.value))
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function focusValidationError(errorMessage: string) {
    const target = parseValidationTarget(options.settings.value, errorMessage)
    if (!target) return false
    const requestId = ++validationFocusRequestId
    if (target.scope !== 'settings') options.currentKey.value = target.pageKey
    validationFocusRequest.value = { requestId, ...target }
    void nextTick(() => {
      if (requestId !== validationFocusRequestId) return
      if (target.blockId) {
        options.selectedBlockIds.value = [target.blockId]
        options.hoveredBlockId.value = target.blockId
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

  return { validationFocusRequest, openPreview, focusValidationError, exportCurrentBlockPageJson, importCurrentBlockPageJson }
}
