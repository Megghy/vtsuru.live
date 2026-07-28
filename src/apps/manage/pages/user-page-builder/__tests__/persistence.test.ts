import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserPagePersistence } from '../useUserPagePersistence'
import type { UserPageValidationIssue } from '../validateUserPagesSettings'

const { publishMyUserPagesSettings } = vi.hoisted(() => ({
  publishMyUserPagesSettings: vi.fn(),
}))

vi.mock('@/apps/user-page/api', () => ({
  clearMyUserPagesDraft: vi.fn(),
  publishMyUserPagesSettings,
  rollbackMyUserPagesPublished: vi.fn(),
  saveMyUserPagesDraft: vi.fn(),
}))

function createPersistence(validationIssues: UserPageValidationIssue[] = []) {
  const settings = ref<UserPagesSettingsV1>({
    version: 1,
    home: { mode: 'legacy' },
    pages: {},
  })
  return useUserPagePersistence({
    settings,
    loadedPublished: ref(null),
    loadedFrom: ref('default'),
    isSaving: ref(false),
    isDirty: ref(true),
    lastSavedAt: ref(null),
    lastSavedSnapshot: ref(''),
    localDraftStorage: ref(null),
    maxConfigBytes: 131072,
    history: { batch: fn => fn(), clear: vi.fn() },
    validateForPublish: vi.fn().mockReturnValue(validationIssues),
    loadState: vi.fn(),
    restoreSnapshot: vi.fn(),
    notify: { success: vi.fn(), error: vi.fn() },
  })
}

describe('user page publishing', () => {
  beforeEach(() => {
    publishMyUserPagesSettings.mockReset()
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
    publishMyUserPagesSettings.mockResolvedValueOnce(undefined)
    const persistence = createPersistence()
    persistence.openPublishModal()

    await persistence.confirmPublish()

    expect(persistence.publishModal.value).toBe(false)
    expect(persistence.publishError.value).toBeNull()
  })

  it('does not publish while structured validation issues remain', async () => {
    const persistence = createPersistence([{
      message: '链接必须使用 HTTPS',
      severity: 'error',
      scope: 'block',
      pageKey: 'home',
      blockId: 'links',
      fieldPath: 'items[0].url',
    }])
    persistence.openPublishModal()

    await persistence.confirmPublish()

    expect(publishMyUserPagesSettings).not.toHaveBeenCalled()
    expect(persistence.publishModal.value).toBe(true)
    expect(persistence.publishCheckIssues.value).toHaveLength(1)
  })
})
