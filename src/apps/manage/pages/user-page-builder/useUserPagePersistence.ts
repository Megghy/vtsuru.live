import type { Ref } from 'vue'
import { ref } from 'vue'

import {
  clearMyUserPagesDraft,
  publishMyUserPagesSettings,
  rollbackMyUserPagesPublished,
  saveMyUserPagesDraft,
} from '@/apps/user-page/api'
import type { BlockPageProject } from '@/apps/user-page/block/schema'
import { reportUserPageError } from '@/apps/user-page/runtime/observability'
import type { UserPagesSettings } from '@/apps/user-page/types'

import { deepCloneJson, estimateUtf8Bytes, pruneHiddenEmptyBlocks } from './editorHelpers'
import type { UserPagesLocalDraftSnapshot } from './useUserPagesLocalDraftStorage'
import type { UserPageValidationIssue } from './validateUserPagesSettings'

export interface UseUserPagePersistenceOptions {
  settings: Ref<UserPagesSettings>
  loadedPublished: Ref<UserPagesSettings | null>
  loadedFrom?: Ref<'draft' | 'published' | 'default'>

  isSaving: Ref<boolean>
  isDirty: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastSavedSnapshot: Ref<string>
  localDraftStorage: Ref<UserPagesLocalDraftSnapshot | null>
  localDraftBaseSnapshot: Ref<string>

  maxConfigBytes: number
  history: {
    batch: (fn: () => void) => void
    clear: () => void
  }
  validateForPublish: (settingsToValidate: UserPagesSettings) => UserPageValidationIssue[]
  loadState: () => Promise<void>
  restoreSnapshot: (snapshot: string) => void

  notify: {
    success: (content: string) => void
    error: (content: string) => void
  }
}

export function useUserPagePersistence(opts: UseUserPagePersistenceOptions) {
  const publishModal = ref(false)
  const publishCheckIssues = ref<UserPageValidationIssue[]>([])
  const publishCheckWarnings = ref<string[]>([])
  const publishCheckBytes = ref<number>(0)
  const publishError = ref<string | null>(null)

  function applyPersistedSettings(requestSnapshot: string, persistedSettings: UserPagesSettings) {
    const persistedSnapshot = JSON.stringify(persistedSettings)
    const hasNewerChanges = JSON.stringify(opts.settings.value) !== requestSnapshot
    opts.lastSavedSnapshot.value = persistedSnapshot
    opts.localDraftBaseSnapshot.value = persistedSnapshot
    if (!hasNewerChanges && JSON.stringify(opts.settings.value) !== persistedSnapshot) {
      opts.settings.value = deepCloneJson(persistedSettings)
    }
    opts.localDraftStorage.value = {
      settings: deepCloneJson(opts.settings.value),
      baseSnapshot: persistedSnapshot,
    }
    opts.isDirty.value = hasNewerChanges
    opts.lastSavedAt.value = Date.now()
    return hasNewerChanges
  }

  function scanPublishWarnings(settingsToScan: UserPagesSettings) {
    let embedCount = 0
    let externalLinkCount = 0

    const scanProject = (project: BlockPageProject | undefined) => {
      if (!project) return
      const walk = (blocks: any[]) => {
        blocks.forEach((b: any) => {
          if (!b || typeof b !== 'object') return
          if (b.hidden) return
          const propsObj = b.props && typeof b.props === 'object' && !Array.isArray(b.props) ? b.props : {}

          if (b.type === 'layout' && Array.isArray(propsObj.children)) {
            walk(propsObj.children)
            return
          }

          if (b.type === 'embed' && typeof propsObj.url === 'string' && propsObj.url.length) embedCount++

          if (
            (b.type === 'links' || b.type === 'buttons' || b.type === 'socialLinks') &&
            Array.isArray(propsObj.items)
          ) {
            externalLinkCount += propsObj.items.filter((it: any) => {
              const url = typeof it?.url === 'string' ? (it.url as string) : ''
              return url.startsWith('https://')
            }).length
          }

          if (b.type === 'button' && typeof propsObj.url === 'string' && propsObj.url.startsWith('https://'))
            externalLinkCount++
        })
      }
      walk(project.blocks as any[])
    }

    if (settingsToScan.home?.mode === 'block') scanProject(settingsToScan.home.block)
    Object.values(settingsToScan.pages ?? {}).forEach((cfg) => {
      if (cfg.mode === 'block') scanProject(cfg.block)
    })

    if (embedCount > 0) publishCheckWarnings.value.push(`包含嵌入资源：${embedCount} 个，发布时会进行白名单校验`)
    if (externalLinkCount > 0) publishCheckWarnings.value.push(`包含外链：约 ${externalLinkCount} 个，将在新页面中打开`)
  }

  function openPublishModal() {
    publishError.value = null
    publishCheckIssues.value = opts.validateForPublish(opts.settings.value)
    publishCheckWarnings.value = []

    const publishSnapshot = deepCloneJson(opts.settings.value)
    const prunedCount = pruneHiddenEmptyBlocks(publishSnapshot)
    if (prunedCount > 0) {
      publishCheckWarnings.value.push(`发布前会自动清理隐藏空区块：${prunedCount} 个；草稿保存不会自动清理`)
    } else {
      publishCheckWarnings.value.push('提示：发布前会自动清理“隐藏且内容为空”的区块；草稿保存不会自动清理')
    }

    const json = JSON.stringify(publishSnapshot)
    publishCheckBytes.value = estimateUtf8Bytes(json)
    if (publishCheckBytes.value > opts.maxConfigBytes) {
      publishCheckIssues.value.push({
        message: `配置过大：${publishCheckBytes.value} bytes，后端上限 ${opts.maxConfigBytes} bytes`,
        severity: 'error',
        scope: 'settings',
        pageKey: null,
        blockId: null,
        fieldPath: null,
      })
    }

    scanPublishWarnings(opts.settings.value)
    publishModal.value = true
  }

  async function saveDraft() {
    await saveDraftInternal(false)
  }

  async function saveDraftInternal(silent: boolean) {
    opts.isSaving.value = true
    try {
      const bytes = estimateUtf8Bytes(JSON.stringify(opts.settings.value))
      if (bytes > opts.maxConfigBytes) {
        let prunedCount = 0
        opts.history.batch(() => {
          prunedCount = pruneHiddenEmptyBlocks(opts.settings.value)
        })
        if (!silent) opts.notify.success(`配置超过上限，已自动清理隐藏空区块：${prunedCount} 个`)
        else
          console.warn(
            `[user-page-builder] Auto save pruned hidden empty blocks due to size limit (${bytes}/${opts.maxConfigBytes})`,
          )
      }
      const savedSettings = deepCloneJson(opts.settings.value)
      const savedSnapshot = JSON.stringify(savedSettings)
      const persistedSettings = await saveMyUserPagesDraft(savedSettings)
      const hasNewerChanges = applyPersistedSettings(savedSnapshot, persistedSettings)
      if (!silent) opts.notify.success(hasNewerChanges ? '草稿已保存，当前仍有新的修改' : '已保存草稿')
      return true
    } catch (e) {
      reportUserPageError(e, 'save-draft')
      if (!silent) opts.notify.error((e as Error).message || String(e))
      else console.error(e)
      return false
    } finally {
      opts.isSaving.value = false
    }
  }

  async function confirmPublish() {
    opts.isSaving.value = true
    publishError.value = null
    try {
      opts.history.batch(() => pruneHiddenEmptyBlocks(opts.settings.value))
      const validationIssues = opts.validateForPublish(opts.settings.value)
      if (validationIssues.length) {
        publishCheckIssues.value = validationIssues
        publishError.value = '请先解决发布检查中的问题'
        publishModal.value = true
        return
      }
      const publishedSnapshot = deepCloneJson(opts.settings.value)
      const publishedSerialized = JSON.stringify(publishedSnapshot)
      const persistedSettings = await publishMyUserPagesSettings(publishedSnapshot)
      opts.loadedPublished.value = persistedSettings
      const hasNewerChanges = applyPersistedSettings(publishedSerialized, persistedSettings)
      if (opts.loadedFrom && !hasNewerChanges) opts.loadedFrom.value = 'published'
      publishModal.value = false
      opts.notify.success(hasNewerChanges ? '已发布请求时的版本，当前仍有新的修改' : '已发布')
    } catch (e) {
      reportUserPageError(e, 'publish')
      publishError.value = (e as Error).message || String(e)
      opts.notify.error(publishError.value)
    } finally {
      opts.isSaving.value = false
    }
  }

  async function clearDraft() {
    opts.isSaving.value = true
    try {
      await clearMyUserPagesDraft()
      opts.localDraftStorage.value = null
      await opts.loadState()
      opts.history.clear()
      opts.notify.success('已清空草稿')
    } catch (e) {
      reportUserPageError(e, 'clear-draft')
      opts.notify.error((e as Error).message || String(e))
    } finally {
      opts.isSaving.value = false
    }
  }

  function discardLocalChanges(snapshot: string) {
    try {
      opts.history.batch(() => opts.restoreSnapshot(snapshot))
      opts.history.clear()
      opts.notify.success('已放弃本地修改')
    } catch (e) {
      reportUserPageError(e, 'discard-local-changes')
      opts.notify.error((e as Error).message || String(e))
    }
  }

  async function rollback() {
    opts.isSaving.value = true
    try {
      await rollbackMyUserPagesPublished()
      await opts.loadState()
      opts.history.clear()
      opts.notify.success('已回滚到上一个已发布版本')
    } catch (e) {
      reportUserPageError(e, 'rollback')
      opts.notify.error((e as Error).message || String(e))
    } finally {
      opts.isSaving.value = false
    }
  }

  return {
    publishModal,
    publishCheckIssues,
    publishCheckWarnings,
    publishCheckBytes,
    publishError,
    openPublishModal,
    saveDraft,
    saveDraftInternal,
    confirmPublish,
    clearDraft,
    discardLocalChanges,
    rollback,
  }
}
