import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import type { UserPagesSettingsV1 } from '@/apps/user-page/types'

import { useUserPageEditorCore } from '../useUserPageEditorCore'

function createCore() {
  return useUserPageEditorCore({
    maxPagesCount: 16,
    notify: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
  })
}

describe('user page editor current page binding', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('follows settings replacements and writes to the active page', () => {
    const scope = effectScope()
    const core = scope.run(createCore)
    const replacement: UserPagesSettingsV1 = {
      version: 1,
      home: { mode: 'legacy', title: '新主页' },
      pages: { works: { mode: 'legacy', title: '作品页' } },
    }

    core.settings.value = replacement
    expect(core.currentPage.value).toBe(core.settings.value.home)

    core.currentKey.value = 'works'
    expect(core.currentPage.value).toBe(core.settings.value.pages.works)

    core.currentPage.value = { mode: 'legacy', title: '替换后的作品页' }
    expect(core.settings.value.pages.works).toBe(core.currentPage.value)
    expect(core.settings.value.pages.works.title).toBe('替换后的作品页')
    scope.stop()
  })

  it('remains bound to restored settings after undo', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const core = scope.run(createCore)
    const originalHome = core.settings.value.home

    core.currentPage.value.title = '已修改'
    await vi.advanceTimersByTimeAsync(150)
    await nextTick()
    expect(core.api.canUndo.value).toBe(true)

    core.api.undo()
    expect(core.settings.value.home).not.toBe(originalHome)
    expect(core.currentPage.value).toBe(core.settings.value.home)

    core.currentPage.value.title = '撤销后继续编辑'
    expect(core.settings.value.home.title).toBe('撤销后继续编辑')
    scope.stop()
  })

  it('returns to home when undo removes the active page', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const core = scope.run(createCore)

    core.api.createPage('works')
    await vi.advanceTimersByTimeAsync(150)
    await nextTick()
    expect(core.currentKey.value).toBe('works')

    core.api.undo()
    expect(core.settings.value.pages.works).toBeUndefined()
    expect(core.currentKey.value).toBe('home')
    expect(core.currentPage.value).toBe(core.settings.value.home)
    scope.stop()
  })
})
