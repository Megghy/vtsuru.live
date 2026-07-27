import { clearMyUserPagesDraft, publishMyUserPagesSettings, rollbackMyUserPagesPublished, saveMyUserPagesDraft } from '@/apps/user-page/api'
import { parseEmbedUrl } from '@/apps/user-page/block/embed'
import { reportUserPageError } from '@/apps/user-page/runtime/observability'
import type { BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { deepCloneJson, estimateUtf8Bytes, pruneHiddenEmptyBlocks } from './editorHelpers'
import type { Ref } from 'vue'
import { ref } from 'vue'

export interface UseUserPagePersistenceOptions {
  settings: Ref<UserPagesSettingsV1>
  loadedPublished: Ref<UserPagesSettingsV1 | null>
  loadedFrom?: Ref<'draft' | 'published' | 'default'>

  isSaving: Ref<boolean>
  isDirty: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastSavedSnapshot: Ref<string>
  localDraftStorage: Ref<UserPagesSettingsV1 | null>

  maxConfigBytes: number
  history: { batch: (fn: () => void) => void }
  validateAll: (settingsToValidate: UserPagesSettingsV1) => void
  loadState: () => Promise<void>

  notify: {
    success: (content: string) => void
    error: (content: string) => void
  }
}

export function useUserPagePersistence(opts: UseUserPagePersistenceOptions) {
  const publishModal = ref(false)
  const publishCheckErrors = ref<string[]>([])
  const publishCheckWarnings = ref<string[]>([])
  const publishCheckBytes = ref<number>(0)

  function scanPublishWarnings(settingsToScan: UserPagesSettingsV1) {
    let embedCount = 0
    let externalLinkCount = 0

    const scanProject = (project: BlockPageProject | undefined) => {
      if (!project) return
      const walk = (blocks: any[]) => {
        blocks.forEach((b: any) => {
          if (!b || typeof b !== 'object') return
          if (b.hidden) return
          const propsObj = (b.props && typeof b.props === 'object' && !Array.isArray(b.props)) ? (b.props) : {}

          if (b.type === 'layout' && Array.isArray(propsObj.children)) {
            walk(propsObj.children)
            return
          }

          if (b.type === 'embed' && typeof propsObj.url === 'string' && propsObj.url.length) {
            embedCount++
            try {
              parseEmbedUrl(propsObj.url, typeof propsObj.title === 'string' ? propsObj.title : undefined)
            } catch (e) {
              publishCheckErrors.value.push(`embed: ${(e as Error).message || String(e)}`)
            }
          }

          if ((b.type === 'links' || b.type === 'buttons') && Array.isArray(propsObj.items)) {
            externalLinkCount += propsObj.items.filter((it: any) => {
              const url = typeof it?.url === 'string' ? (it.url as string) : ''
              return url.startsWith('https://')
            }).length
          }

          if (b.type === 'button' && typeof propsObj.url === 'string' && propsObj.url.startsWith('https://')) externalLinkCount++

          if (b.type === 'profile' && typeof propsObj.avatarUrl === 'string' && propsObj.avatarUrl.startsWith('https://')) externalLinkCount++
        })
      }
      walk(project.blocks as any[])
    }

    if (settingsToScan.home?.mode === 'block') scanProject(settingsToScan.home.block)
    Object.values(settingsToScan.pages ?? {}).forEach((cfg) => {
      if (cfg.mode === 'block') scanProject(cfg.block)
    })

    if (embedCount > 0) publishCheckWarnings.value.push(`包含 embed：${embedCount} 个，发布时会做 provider 白名单校验`)
    if (externalLinkCount > 0) publishCheckWarnings.value.push(`包含外链：约 ${externalLinkCount} 个，访客打开将自动 noopener/noreferrer`)
  }

  function openPublishModal() {
    publishCheckErrors.value = []
    publishCheckWarnings.value = []

    try {
      opts.validateAll(opts.settings.value)
    } catch (e) {
      publishCheckErrors.value.push(...((e as Error).message || String(e)).split('\n').filter(Boolean))
    }

    const publishSnapshot = deepCloneJson(opts.settings.value)
    const prunedCount = pruneHiddenEmptyBlocks(publishSnapshot)
    if (prunedCount > 0) {
      publishCheckWarnings.value.push(`发布前会自动清理隐藏空区块：${prunedCount} 个；草稿保存不会自动清理`)
    } else {
      publishCheckWarnings.value.push('提示：发布前会自动清理“隐藏且内容为空”的区块；草稿保存不会自动清理')
    }

    const json = JSON.stringify(publishSnapshot)
    publishCheckBytes.value = estimateUtf8Bytes(json)
    if (publishCheckBytes.value > opts.maxConfigBytes) publishCheckErrors.value.push(`配置过大：${publishCheckBytes.value} bytes，后端上限 ${opts.maxConfigBytes} bytes`)

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
        else console.warn(`[user-page-builder] Auto save pruned hidden empty blocks due to size limit (${bytes}/${opts.maxConfigBytes})`)
      }
      const savedSettings = deepCloneJson(opts.settings.value)
      const savedSnapshot = JSON.stringify(savedSettings)
      await saveMyUserPagesDraft(savedSettings)
      opts.localDraftStorage.value = deepCloneJson(savedSettings)
      opts.lastSavedSnapshot.value = savedSnapshot
      opts.isDirty.value = JSON.stringify(opts.settings.value) !== savedSnapshot
      opts.lastSavedAt.value = Date.now()
      if (!silent) opts.notify.success(opts.isDirty.value ? '草稿已保存，当前仍有新的修改' : '已保存草稿')
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
    try {
      opts.history.batch(() => pruneHiddenEmptyBlocks(opts.settings.value))
      opts.validateAll(opts.settings.value)
      const publishedSnapshot = deepCloneJson(opts.settings.value)
      const publishedSerialized = JSON.stringify(publishedSnapshot)
      await publishMyUserPagesSettings(publishedSnapshot)
      opts.localDraftStorage.value = deepCloneJson(publishedSnapshot)
      opts.loadedPublished.value = publishedSnapshot
      const hasNewerChanges = JSON.stringify(opts.settings.value) !== publishedSerialized
      if (opts.loadedFrom && !hasNewerChanges) opts.loadedFrom.value = 'published'
      opts.lastSavedAt.value = Date.now()
      opts.lastSavedSnapshot.value = publishedSerialized
      opts.isDirty.value = hasNewerChanges
      publishModal.value = false
      opts.notify.success(hasNewerChanges ? '已发布请求时的版本，当前仍有新的修改' : '已发布')
    } catch (e) {
      reportUserPageError(e, 'publish')
      opts.notify.error((e as Error).message || String(e))
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
      opts.notify.success('已清空草稿')
    } catch (e) {
      reportUserPageError(e, 'clear-draft')
      opts.notify.error((e as Error).message || String(e))
    } finally {
      opts.isSaving.value = false
    }
  }

  async function rollback() {
    opts.isSaving.value = true
    try {
      await rollbackMyUserPagesPublished()
      await opts.loadState()
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
    publishCheckErrors,
    publishCheckWarnings,
    publishCheckBytes,
    openPublishModal,
    saveDraft,
    saveDraftInternal,
    confirmPublish,
    clearDraft,
    rollback,
  }
}
