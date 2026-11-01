import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const mockAccount = ref({ id: 101, name: '测试主播', token: 'token-101' })
vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
}))

const mockPostAPI = vi.fn()
vi.mock('@/api/query', () => ({
  QueryPostAPI: (...args: unknown[]) => mockPostAPI(...args),
}))

const topicListeners = new Map<string, (payload: any) => void>()
const publishedEvents: Array<{ topic: string; eventName: string; payload: any }> = []

vi.mock('@/shared/realtime', () => ({
  useRealtimeTopic: (topic: string) => {
    return {
      on: (eventName: string, handler: (payload: any) => void) => {
        topicListeners.set(eventName, handler)
        return () => topicListeners.delete(eventName)
      },
      publish: vi.fn(async (eventName: string, payload: any) => {
        publishedEvents.push({ topic, eventName, payload })
      }),
    }
  },
}))

import { usePngtuberCollab } from '../usePngtuberCollab'

describe('usePngtuberCollab', () => {
  beforeEach(() => {
    topicListeners.clear()
    publishedEvents.length = 0
    mockPostAPI.mockReset()
    const collab = usePngtuberCollab()
    collab.leaveRoom()
  })

  it('creates room via API and joins it automatically', async () => {
    mockPostAPI.mockResolvedValueOnce({
      data: { roomCode: 'ROOM88', hostUserId: 101 },
    })

    const collab = usePngtuberCollab()
    const code = await collab.createRoom()

    expect(code).toBe('ROOM88')
    expect(mockPostAPI).toHaveBeenCalledWith(expect.stringMatching(/\/api\/obs-store\/pngtuber\/collab\/create-room$/), {})
    expect(mockPostAPI).not.toHaveBeenCalledWith(expect.stringContaining('/api/api/'), expect.anything())
    expect(collab.currentRoomCode.value).toBe('ROOM88')
    expect(collab.isHost.value).toBe(true)
    expect(collab.inRoom.value).toBe(true)

    // 应上报自身信息
    expect(publishedEvents).toContainEqual(
      expect.objectContaining({
        topic: 'pngtuber:room:ROOM88',
        eventName: 'join',
        payload: expect.objectContaining({ userId: 101, name: '测试主播' }),
      }),
    )
  })

  it('updates member states correctly across room events', async () => {
    const collab = usePngtuberCollab()
    await collab.joinRoom('ROOM99', false)

    expect(collab.currentRoomCode.value).toBe('ROOM99')
    expect(collab.isHost.value).toBe(false)

    // 收到快照
    const snapshotHandler = topicListeners.get('room_snapshot')
    expect(snapshotHandler).toBeDefined()
    snapshotHandler!({
      members: [
        { userId: 202, name: '嘉宾小明', volume: 0, isSpeaking: false },
      ],
    })
    expect(collab.members.value.length).toBe(1)
    expect(collab.members.value[0].name).toBe('嘉宾小明')

    // 收到 member_joined
    const joinHandler = topicListeners.get('member_joined')
    joinHandler!({
      userId: 303,
      name: '嘉宾小红',
      volume: 10,
      isSpeaking: false,
    })
    expect(collab.members.value.length).toBe(2)

    // 收到 member_audio
    const audioHandler = topicListeners.get('member_audio')
    audioHandler!({
      userId: 303,
      volume: 85,
      isSpeaking: true,
    })
    const m303 = collab.members.value.find((item) => item.userId === 303)
    expect(m303?.volume).toBe(85)
    expect(m303?.isSpeaking).toBe(true)

    // 收到 member_control (静音自动闭嘴)
    const controlHandler = topicListeners.get('member_control')
    controlHandler!({
      userId: 303,
      muted: true,
    })
    expect(m303?.muted).toBe(true)
    expect(m303?.isSpeaking).toBe(false)
    expect(m303?.volume).toBe(0)

    // 收到 member_left
    const leftHandler = topicListeners.get('member_left')
    leftHandler!({ userId: 202 })
    expect(collab.members.value.length).toBe(1)
    expect(collab.members.value[0].userId).toBe(303)

    // 主动离开房间
    collab.leaveRoom()
    expect(collab.inRoom.value).toBe(false)
    expect(collab.members.value.length).toBe(0)
  })
})
