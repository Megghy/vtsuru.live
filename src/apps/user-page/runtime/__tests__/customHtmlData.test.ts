import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ questions: vi.fn(), tags: vi.fn(), goods: vi.fn() }))
vi.mock('@/api/generated/qa/qa', () => ({ getApiQaGetPublic: mocks.questions, getApiQaGetTags: mocks.tags }))
vi.mock('@/api/generated/check-in/check-in', () => ({ getApiCheckinKeyword: vi.fn(), getApiCheckinRanking: vi.fn() }))
vi.mock('@/api/generated/schedule/schedule', () => ({ getApiScheduleGet: vi.fn(), getApiScheduleBiliReserve: vi.fn() }))
vi.mock('@/apps/user-page/api', () => ({
  fetchPublicPointGoods: mocks.goods,
  fetchPublicActiveVideoCollect: vi.fn(),
  fetchPublicSongList: vi.fn(),
  fetchPublicSongRequestState: vi.fn(),
}))
vi.mock('@/api/query', () => ({ unwrapOk: (response: { data: unknown }) => response.data }))
vi.mock('../query', () => ({
  loadCached: (_key: string, loader: (signal: AbortSignal) => Promise<unknown>) => loader(new AbortController().signal),
}))

import { createCustomHtmlDataHandlers } from '../customHtmlData'

describe('custom HTML public data projection', () => {
  it('omits anonymous email and identity data from public questions', async () => {
    mocks.tags.mockResolvedValue({ data: ['general'] })
    mocks.questions.mockResolvedValue({
      data: [
        {
          id: 1,
          tag: 'general',
          question: { message: 'Q' },
          answer: { message: 'A' },
          sendAt: 1,
          isAnonymous: true,
          anonymousName: '访客',
          anonymousEmail: 'secret@example.test',
          sender: { id: 99, name: 'Private' },
          questionImages: [],
          answerImages: [],
        },
      ],
    })
    const result = await createCustomHtmlDataHandlers(() => 42).getQuestions(undefined, true)
    expect(result.questions[0]).toMatchObject({ id: 1, senderName: '访客', question: { message: 'Q' } })
    expect(JSON.stringify(result)).not.toContain('secret@example.test')
    expect(JSON.stringify(result)).not.toContain('Private')
    expect(JSON.stringify(result)).not.toContain('99')
  })

  it('omits virtual keys and internal service configuration from goods', async () => {
    mocks.goods.mockResolvedValue([
      {
        id: 2,
        name: 'Gift',
        description: 'Public',
        price: 10,
        tags: [],
        status: 0,
        type: 1,
        canPurchase: true,
        virtualKeys: ['SECRET-KEY'],
        serviceConfig: { token: 'SECRET-TOKEN' },
      },
    ])
    const result = await createCustomHtmlDataHandlers(() => 42).getPointGoods()
    expect(result[0]).toMatchObject({ id: 2, name: 'Gift', price: 10 })
    expect(JSON.stringify(result)).not.toContain('SECRET-KEY')
    expect(JSON.stringify(result)).not.toContain('SECRET-TOKEN')
  })
})
