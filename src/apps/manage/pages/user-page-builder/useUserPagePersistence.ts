import { clearMyUserPagesDraft, publishMyUserPagesSettings, rollbackMyUserPagesPublished, saveMyUserPagesDraft } from '@/apps/user-page/api'
import { parseEmbedUrl } from '@/apps/user-page/block/embed'
import type { BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { deepCloneJson, estimateUtf8Bytes, pruneHiddenEmptyBlocks } from './editorHelpers'
import { useUserPagesLocalDraftStorage } from './useUserPagesLocalDraftStorage'
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
  const localDraftStorage = useUserPagesLocalDraftStorage()

  function scanPublishWarnings(settingsToScan: UserPagesSettingsV1) {
    let embedCount = 0
    let externalLinkCount = 0

    const scanProject = (project: BlockPageProject | undefined) => {
      if (!project) return
      const walk = (blocks: any[]) => {
        blocks.forEach((b: any) => {
          if (!b || typeof b !== 'object') return
          if (b.hidden) return
          const propsObj = (b.props && typeof b.props === 'object' && !Array.isArray(b.props)) ? (b.props as any) : {}

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
            externalLinkCount += propsObj.items.filter((it: any) => typeof it?.url === 'string' && it.url.startsWith('https://')).length
          }

          if (b.type === 'image' && typeof propsObj.url === 'string' && propsObj.url.startsWith('https://')) externalLinkCount++
          if (b.type === 'profile' && typeof propsObj.avatarUrl === 'string' && propsObj.avatarUrl.startsWith('https://')) externalLinkCount++
        })
      }
      walk(project.blocks as any[])
    }

    if (settingsToScan.home?.mode === 'block') scanProject(settingsToScan.home.block)
    Object.values(settingsToScan.pages ?? {}).forEach((cfg) => {
      if (cfg.mode === 'block') scanProject(cfg.block)
    })

    if (embedCount > 0) publishCheckWarnings.value.push(`包含 embed：${embedCount} 个（发布会做 provider 白名单校验）`)
    if (externalLinkCount > 0) publishCheckWarnings.value.push(`包含外链：约 ${externalLinkCount} 个（访客打开将自动 noopener/noreferrer）`)
  }

  function openPublishModal() {
    publishCheckErrors.value = []
    publishCheckWarnings.value = []

    try {
      opts.validateAll(opts.settings.value)
    } catch (e) {
      publishCheckErrors.value.push((e as Error).message || String(e))
    }

    const publishSnapshot = deepCloneJson(opts.settings.value)
    const prunedCount = pruneHiddenEmptyBlocks(publishSnapshot)
    if (prunedCount > 0) {
      publishCheckWarnings.value.push(`发布前会自动清理隐藏空区块：${prunedCount} 个（草稿保存不会自动清理）`)
    } else {
      publishCheckWarnings.value.push('提示：发布前会自动清理“隐藏且内容为空”的区块（草稿保存不会自动清理）')
    }

    const json = JSON.stringify(publishSnapshot)
    publishCheckBytes.value = estimateUtf8Bytes(json)
    if (publishCheckBytes.value > opts.maxConfigBytes) publishCheckErrors.value.push(`配置过大：${publishCheckBytes.value} bytes（后端上限 ${opts.maxConfigBytes} bytes）`)

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
      await saveMyUserPagesDraft(opts.settings.value)
      localDraftStorage.value = deepCloneJson(opts.settings.value)
      if (silent) {
        opts.lastSavedSnapshot.value = JSON.stringify(opts.settings.value)
        opts.isDirty.value = false
        opts.lastSavedAt.value = Date.now()
      } else {
        await opts.loadState()
        opts.notify.success('已保存草稿')
      }
      return true
    } catch (e) {
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
      await publishMyUserPagesSettings(opts.settings.value)
      localDraftStorage.value = deepCloneJson(publishedSnapshot)
      opts.loadedPublished.value = publishedSnapshot
      if (opts.loadedFrom) opts.loadedFrom.value = 'published'
      opts.lastSavedAt.value = Date.now()
      opts.lastSavedSnapshot.value = JSON.stringify(publishedSnapshot)
      opts.isDirty.value = false
      publishModal.value = false
      opts.notify.success('已发布')
    } catch (e) {
      opts.notify.error((e as Error).message || String(e))
    } finally {
      opts.isSaving.value = false
    }
  }

  async function clearDraft() {
    opts.isSaving.value = true
    try {
      await clearMyUserPagesDraft()
      localDraftStorage.value = null
      await opts.loadState()
      opts.notify.success('已清空草稿')
    } catch (e) {
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
