import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  findSong: vi.fn(),
  requestState: vi.fn(),
}))

vi.mock('@/api/account', () => ({ useAccount: () => ({ value: { id: 1 } }) }))
vi.mock('@/store/useBiliAuth', () => ({ useBiliAuth: () => ({ isAuthed: false }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/shared/utils', () => ({
  useMessage: () => ({ info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/shared/storage/persist', () => ({ usePersistedStorage: () => ref(new Date(0)) }))
vi.mock('@/api/generated/live-request/live-request', () => ({ postApiLiveRequestAddFromWeb: mocks.post }))
vi.mock('@/api/query', () => ({ unwrapOk: (value: unknown) => value }))
vi.mock('@/apps/user-page/api', () => ({ fetchPublicSongRequestState: mocks.requestState }))
vi.mock('@/apps/user/pages/songListTemplate/utils/songRequestUtils', () => ({
  canRequestSong: () => ({ canRequest: true }),
}))
vi.mock('../customHtmlData', () => ({ createCustomHtmlDataHandlers: () => ({ findSong: mocks.findSong }) }))

import { useCustomHtmlBridge } from '../useCustomHtmlBridge'

function mountHost() {
  const scope = effectScope()
  const owner = ref({ id: 42, streamerInfo: { roomId: 1, title: 'Live' }, name: 'Owner' } as ResponseUserInfo)
  const host = scope.run(() => useCustomHtmlBridge({ userInfo: owner }))!
  return { ...host, owner, dispose: () => scope.stop() }
}

async function waitForConfirmation(host: ReturnType<typeof mountHost>) {
  await vi.waitFor(() => expect(host.dialog.song.value?.key).toBe('song-key'))
}

beforeEach(() => {
  mocks.post.mockReset().mockResolvedValue({ code: 200 })
  mocks.findSong.mockReset().mockResolvedValue({ key: 'song-key', name: 'Song' })
  mocks.requestState.mockReset().mockResolvedValue({ setting: { allowFromWeb: true } })
})

describe('custom HTML host writes', () => {
  it('does not post a cancelled song request', async () => {
    const host = mountHost()
    const pending = host.handlers.value.requestSong!('song-key')
    await waitForConfirmation(host)
    host.dialog.confirmSong(false)
    await expect(pending).resolves.toMatchObject({ action: 'cancelled' })
    expect(mocks.post).not.toHaveBeenCalled()
    host.dispose()
  })

  it('posts one confirmed request and enforces cooldown', async () => {
    const host = mountHost()
    const pending = host.handlers.value.requestSong!('song-key')
    await waitForConfirmation(host)
    await expect(host.handlers.value.requestSong!('song-key')).rejects.toThrow('已有待确认')
    host.dialog.confirmSong(true)
    await expect(pending).resolves.toMatchObject({ action: 'requested' })
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith({ target: 42, song: 'song-key' }, undefined)
    await expect(host.handlers.value.requestSong!('song-key')).rejects.toThrow('冷却')
    host.dispose()
  })

  it('cancels pending confirmation when owner or iframe changes', async () => {
    const host = mountHost()
    const first = host.handlers.value.requestSong!('song-key')
    await waitForConfirmation(host)
    host.owner.value = { ...host.owner.value, id: 43 }
    await nextTick()
    await expect(first).resolves.toMatchObject({ action: 'cancelled' })
    const second = host.handlers.value.requestSong!('song-key')
    await waitForConfirmation(host)
    host.cancelPending()
    await expect(second).resolves.toMatchObject({ action: 'cancelled' })
    expect(mocks.post).not.toHaveBeenCalled()
    host.dispose()
  })

  it('keeps the request locked while the confirmed write is in flight', async () => {
    let finish!: (value: unknown) => void
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const host = mountHost()
    const pending = host.handlers.value.requestSong!('song-key')
    await waitForConfirmation(host)
    host.dialog.confirmSong(true)
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1))
    await expect(host.handlers.value.requestSong!('song-key')).rejects.toThrow('正在提交')
    expect(host.dialog.song.value).toBeNull()
    finish({ code: 200 })
    await expect(pending).resolves.toMatchObject({ action: 'requested' })
    expect(mocks.post).toHaveBeenCalledTimes(1)
    host.dispose()
  })
})
