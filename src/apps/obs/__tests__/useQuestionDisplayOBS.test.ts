import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as queryApi from '@/api/query'
import {
  QUESTION_DISPLAY_OBS_ENDPOINTS,
  useQuestionDisplayOBS,
} from '@/apps/obs/composables/useQuestionDisplayOBS'
import { createMockQuestion, createMockQuestionDisplaySetting } from '@/test/testUtils'

describe('useQuestionDisplayOBS', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('无 id 且无 token 时状态为 unauthorized 且不发起网络请求', async () => {
    const querySpy = vi.spyOn(queryApi, 'QueryGetAPI')

    const obs = useQuestionDisplayOBS({
      active: true,
      visible: true,
    })

    expect(obs.state.value).toBe('unauthorized')
    expect(querySpy).not.toHaveBeenCalled()
  })

  it('有 id 时首次 refresh 用 id 拉取快照', async () => {
    const mockQuestion = createMockQuestion({ id: 123 })
    const mockSetting = createMockQuestionDisplaySetting()
    const querySpy = vi.spyOn(queryApi, 'QueryGetAPI').mockImplementation(async (url: string) => {
      if (url === QUESTION_DISPLAY_OBS_ENDPOINTS.snapshot) {
        return {
          code: 200,
          message: 'OK',
          data: {
            question: mockQuestion,
            setting: mockSetting,
          },
        } as any
      }
      return { code: 200, message: 'OK', data: 'hash_1' } as any
    })

    const obs = useQuestionDisplayOBS({
      userId: 42,
      active: true,
      visible: true,
    })

    obs.resume()
    await obs.refresh(true)

    expect(obs.state.value).toBe('ready')
    expect(querySpy).toHaveBeenCalledWith(
      QUESTION_DISPLAY_OBS_ENDPOINTS.snapshot,
      { id: '42' },
      undefined,
      expect.anything(),
    )
  })

  it('有 token 时首次 refresh 成功拉取快照并设为 ready', async () => {
    const mockQuestion = createMockQuestion({ id: 123 })
    const mockSetting = createMockQuestionDisplaySetting()

    vi.spyOn(queryApi, 'QueryGetAPI').mockImplementation(async (url: string) => {
      if (url === QUESTION_DISPLAY_OBS_ENDPOINTS.snapshot) {
        return {
          code: 200,
          message: 'OK',
          data: {
            question: mockQuestion,
            setting: mockSetting,
          },
        } as any
      }
      return { code: 200, message: 'OK', data: 'hash_1' } as any
    })

    const token = ref('valid-test-token')
    const obs = useQuestionDisplayOBS({
      token,
      active: true,
      visible: true,
      pollIntervalMs: 1000,
    })

    obs.resume()
    await obs.refresh(true)

    expect(obs.state.value).toBe('ready')
    expect(obs.question.value?.id).toBe(123)
    expect(obs.lastUpdatedAt.value).toBeDefined()
  })

  it('轮询探测到新哈希时触发更新快照', async () => {
    const mockQuestion1 = createMockQuestion({ id: 101 })
    const mockQuestion2 = createMockQuestion({ id: 102, question: { message: '新提问' } })
    const mockSetting = createMockQuestionDisplaySetting()

    let currentHash = 'hash_v1'
    let currentQuestion = mockQuestion1

    const querySpy = vi.spyOn(queryApi, 'QueryGetAPI').mockImplementation(async (url: string) => {
      if (url === QUESTION_DISPLAY_OBS_ENDPOINTS.snapshot) {
        return {
          code: 200,
          message: 'OK',
          data: { question: currentQuestion, setting: mockSetting },
        } as any
      }
      if (url === QUESTION_DISPLAY_OBS_ENDPOINTS.version) {
        return { code: 200, message: 'OK', data: currentHash } as any
      }
      return { code: 200, message: 'OK', data: null } as any
    })

    const token = ref('token-abc')
    const obs = useQuestionDisplayOBS({
      token,
      active: true,
      visible: true,
      pollIntervalMs: 1000,
    })

    obs.resume()
    await obs.refresh(true)
    expect(obs.question.value?.id).toBe(101)

    // 首次轮询版本探测，哈希未变，不应重复请求 snapshot
    querySpy.mockClear()
    await obs.refresh(false)
    expect(obs.version.value).toBe('hash_v1')
    expect(querySpy).toHaveBeenCalledTimes(1)
    expect(querySpy).toHaveBeenCalledWith(
      QUESTION_DISPLAY_OBS_ENDPOINTS.version,
      expect.anything(),
      undefined,
      expect.anything(),
    )

    // 当服务端发生切题，哈希改变
    currentHash = 'hash_v2'
    currentQuestion = mockQuestion2
    querySpy.mockClear()

    await obs.refresh(false)
    expect(obs.version.value).toBe('hash_v2')
    expect(obs.question.value?.id).toBe(102)
    expect(obs.question.value?.question.message).toBe('新提问')
  })

  it('后端返回 401 时状态置为 unauthorized', async () => {
    vi.spyOn(queryApi, 'QueryGetAPI').mockResolvedValue({
      code: 401,
      message: 'Unauthorized',
      data: null,
    } as any)

    const token = ref('expired-token')
    const obs = useQuestionDisplayOBS({
      token,
      active: true,
      visible: true,
    })

    obs.resume()
    await obs.refresh(true)
    expect(obs.state.value).toBe('unauthorized')
  })
})
