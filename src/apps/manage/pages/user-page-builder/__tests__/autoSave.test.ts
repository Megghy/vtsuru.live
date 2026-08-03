import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import type { UserPagesSettings } from '@/apps/user-page/types'

import { useUserPageAutoSave } from '../useUserPageAutoSave'

function createAutoSave(saveDraft: () => Promise<boolean>) {
  const settings = ref<UserPagesSettings>({
    version: 2,
    home: { mode: 'legacy' },
    pages: {},
  })
  const lastSavedSnapshot = ref(JSON.stringify(settings.value))
  const api = useUserPageAutoSave({
    settings,
    isLoading: ref(false),
    isSaving: ref(false),
    isDirty: ref(false),
    lastSavedAt: ref<number | null>(null),
    lastSavedSnapshot,
    error: ref<string | null>(null),
    jsonSanitizedNotified: ref(false),
    validateAll: vi.fn().mockReturnValue([]),
    saveDraft,
    notifyError: vi.fn(),
  })
  return { api, settings }
}

describe('user page auto save status', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows local persistence and retries a failed server sync', async () => {
    vi.useFakeTimers()
    const saveDraft = vi.fn().mockResolvedValue(false)
    const scope = effectScope()
    const state = scope.run(() => createAutoSave(saveDraft))

    state.settings.value.home.title = '本机修改'
    await nextTick()
    expect(state.api.saveStatusText.value).toBe('本机已保存')

    await vi.advanceTimersByTimeAsync(1600)
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(state.api.hasSyncError.value).toBe(true)
    expect(state.api.saveStatusText.value).toBe('同步失败')

    await vi.advanceTimersByTimeAsync(3000)
    expect(saveDraft).toHaveBeenCalledTimes(2)
    state.api.destroy()
    scope.stop()
  })

  it('states that automatic server sync is disabled', async () => {
    const scope = effectScope()
    const state = scope.run(() => createAutoSave(vi.fn().mockResolvedValue(true)))
    state.api.autoSaveEnabled.value = false
    state.settings.value.home.title = '仅保存在本机'
    await nextTick()

    expect(state.api.saveStatusText.value).toBe('本机已保存 · 自动同步关闭')
    state.api.destroy()
    scope.stop()
  })
})
