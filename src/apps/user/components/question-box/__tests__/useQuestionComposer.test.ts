import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type Ref } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'

import { useQuestionComposer } from '../useQuestionComposer'

const mocked = vi.hoisted(() => ({
  account: null as Ref<{ id?: number; name?: string } | undefined> | null,
  draft: null as Ref<any> | null,
}))

vi.mock('@/api/account', async () => {
  const { ref: vueRef } = await import('vue')
  mocked.account = vueRef(undefined)
  return {
    ACCOUNT: mocked.account,
    useAccount: () => mocked.account,
  }
})

vi.mock('@/shared/storage/persist', async () => {
  const { ref: vueRef } = await import('vue')
  mocked.draft = vueRef(undefined)
  return {
    usePersistedStorage: (_key: unknown, initialValue: unknown) => {
      mocked.draft!.value = structuredClone(initialValue)
      return mocked.draft
    },
  }
})

function createTarget(overrides: Partial<NonNullable<ResponseUserInfo['extra']>> = {}): ResponseUserInfo {
  return {
    id: 200,
    name: '测试主播',
    extra: {
      allowQuestionBoxUploadImage: false,
      allowQuestionBoxAnonymous: true,
      allowQuestionBoxUnregistedUser: true,
      showQuestionBoxPublicReplies: true,
      ...overrides,
    },
  } as ResponseUserInfo
}

describe('useQuestionComposer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocked.account!.value = undefined
    mocked.draft!.value = undefined
  })

  it('keeps canSubmit enabled after async draft hydration sets isAnonymous=true when anonymous is disabled', async () => {
    mocked.account!.value = { id: 100, name: '已登录用户' }
    const target = ref<ResponseUserInfo | undefined>(createTarget({ allowQuestionBoxAnonymous: false }))

    const scope = effectScope()
    const composer = scope.run(() => useQuestionComposer(target, vi.fn()))!

    // 模拟异步持久化存储（IndexedDB）稍后回写旧草稿（isAnonymous: true）
    mocked.draft!.value = {
      message: '这是一条有效留言',
      tag: null,
      anonymousName: '',
      anonymousEmail: 'invalid-old-email',
      isAnonymous: true,
      allowPublic: true,
    }
    composer.token.value = 'captcha-token'
    await nextTick()

    expect(composer.draft.value.isAnonymous).toBe(false)
    expect(composer.canSubmit.value).toBe(true)
    scope.stop()
  })

  it('trims guest email whitespace and ignores hidden email when logged in', async () => {
    const target = ref<ResponseUserInfo | undefined>(createTarget())
    const scope = effectScope()
    const composer = scope.run(() => useQuestionComposer(target, vi.fn()))!

    composer.draft.value.message = '留言内容足够长'
    composer.draft.value.anonymousEmail = 'viewer@example.com '
    composer.token.value = 'captcha-token'
    await nextTick()

    expect(composer.canSubmit.value).toBe(true)

    // 访客填错邮箱时提示原因并禁用
    composer.draft.value.anonymousEmail = 'not-an-email'
    await nextTick()
    expect(composer.canSubmit.value).toBe(false)
    expect(composer.submitDisabledReason.value).toBe('邮箱格式不正确')

    // 登录后匿名邮箱输入框隐藏，不应继续阻塞提交
    mocked.account!.value = { id: 100, name: '已登录用户' }
    await nextTick()
    expect(composer.canSubmit.value).toBe(true)
    scope.stop()
  })

  it('does not treat undefined target and logged-out visitor as self', () => {
    const target = ref<ResponseUserInfo | undefined>(undefined)
    const scope = effectScope()
    const composer = scope.run(() => useQuestionComposer(target, vi.fn()))!

    expect(composer.isSelf.value).toBe(false)
    scope.stop()
  })
})
