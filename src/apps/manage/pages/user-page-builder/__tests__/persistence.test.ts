import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { createDefaultCustomPageProps } from '@/apps/user-page/block/customHtmlContract'
import type { UserPagesSettings } from '@/apps/user-page/types'

import { useUserPagePersistence } from '../useUserPagePersistence'
import type { UserPageValidationIssue } from '../validateUserPagesSettings'

const { publishMyUserPagesSettings, saveMyUserPagesDraft } = vi.hoisted(() => ({
  publishMyUserPagesSettings: vi.fn(),
  saveMyUserPagesDraft: vi.fn(),
}))

vi.mock('@/apps/user-page/api', () => ({
  clearMyUserPagesDraft: vi.fn(),
  publishMyUserPagesSettings,
  rollbackMyUserPagesPublished: vi.fn(),
  saveMyUserPagesDraft,
}))

function createPersistence(validationIssues: UserPageValidationIssue[] = []) {
  const settings = ref<UserPagesSettings>({
    version: 2,
    home: { mode: 'legacy' },
    pages: {},
  })
  const persistence = useUserPagePersistence({
    settings,
    loadedPublished: ref(null),
    loadedFrom: ref('default'),
    isSaving: ref(false),
    isDirty: ref(true),
    lastSavedAt: ref(null),
    lastSavedSnapshot: ref(''),
    localDraftStorage: ref(null),
    localDraftBaseSnapshot: ref(''),
    maxConfigBytes: 2 * 1024 * 1024,
    history: { batch: (fn) => fn(), clear: vi.fn() },
    validateForPublish: vi.fn().mockReturnValue(validationIssues),
    loadState: vi.fn(),
    restoreSnapshot: vi.fn(),
    notify: { success: vi.fn(), error: vi.fn() },
  })
  return { ...persistence, settings }
}

describe('user page publishing', () => {
  beforeEach(() => {
    publishMyUserPagesSettings.mockReset()
    publishMyUserPagesSettings.mockImplementation(async (settings) => structuredClone(settings))
    saveMyUserPagesDraft.mockReset()
    saveMyUserPagesDraft.mockImplementation(async (settings) => structuredClone(settings))
  })

  it('keeps the publish dialog open with a retryable error', async () => {
    publishMyUserPagesSettings.mockRejectedValueOnce(new Error('发布请求失败'))
    const persistence = createPersistence()
    persistence.openPublishModal()

    await persistence.confirmPublish()

    expect(persistence.publishModal.value).toBe(true)
    expect(persistence.publishError.value).toBe('发布请求失败')
  })

  it('closes the publish dialog only after success', async () => {
    const persistence = createPersistence()
    persistence.openPublishModal()

    await persistence.confirmPublish()

    expect(persistence.publishModal.value).toBe(false)
    expect(persistence.publishError.value).toBeNull()
  })

  it('does not publish while structured validation issues remain', async () => {
    const persistence = createPersistence([
      {
        message: '链接必须使用 HTTPS',
        severity: 'error',
        scope: 'block',
        pageKey: 'home',
        blockId: 'links',
        fieldPath: 'items[0].url',
      },
    ])
    persistence.openPublishModal()

    await persistence.confirmPublish()

    expect(publishMyUserPagesSettings).not.toHaveBeenCalled()
    expect(persistence.publishModal.value).toBe(true)
    expect(persistence.publishCheckIssues.value).toHaveLength(1)
  })

  it('sends custom code, assets and immersive mode in draft and publish snapshots', async () => {
    const persistence = createPersistence()
    const custom = createDefaultCustomPageProps()
    custom.js = 'await vtsuru.getContext()'
    custom.assets = [{ key: 'cover', file: { id: 1, path: '/file/1' } as any }]
    custom.immersive = true
    persistence.settings.value.home = { mode: 'custom', custom }

    await persistence.saveDraft()
    persistence.openPublishModal()
    await persistence.confirmPublish()

    expect(saveMyUserPagesDraft.mock.calls[0][0].home.custom).toEqual(custom)
    expect(publishMyUserPagesSettings.mock.calls[0][0].home.custom).toEqual(custom)
  })
})
