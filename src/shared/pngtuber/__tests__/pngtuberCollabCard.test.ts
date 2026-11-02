import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const currentRoomCode = ref('')
const isMockCollab = ref(false)

vi.mock('@/api/account', () => ({
  useAccount: () => ref({ id: 12, name: '测试' }),
}))

vi.mock('@/shared/pngtuber/usePngtuberCollab', () => ({
  usePngtuberCollab: () => ({
    currentRoomCode,
    isHost: ref(false),
    inRoom: ref(false),
    members: ref([]),
    collabError: ref(''),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
  }),
}))

vi.mock('@/shared/pngtuber/usePngtuberDebugger', () => ({
  usePngtuberDebugger: () => ({
    isMockCollab,
    mockMembers: ref([]),
    autoCollabSpeaker: ref(false),
    toggleMockCollab: vi.fn(),
    cycleCollabSpeaker: vi.fn(),
    toggleAutoCollabSpeaker: vi.fn(),
    addMockMember: vi.fn(),
    removeMockMember: vi.fn(),
    setMemberSpeaking: vi.fn(),
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import PngtuberCollabCard from '../PngtuberCollabCard.vue'

describe('PngtuberCollabCard OBS url', () => {
  beforeEach(() => {
    currentRoomCode.value = ''
    isMockCollab.value = false
  })

  it('omits mock=1 when a real room code is present', () => {
    currentRoomCode.value = 'ROOM88'
    isMockCollab.value = true
    const wrapper = mount(PngtuberCollabCard, { props: { channel: 'default' } })
    const href = wrapper.find('a[href*="pngtuber-collab"]').attributes('href') ?? ''
    expect(href).toContain('room=ROOM88')
    expect(href).not.toContain('mock=')
    wrapper.unmount()
  })

  it('includes mock=1 only for mock-only preview without a room', () => {
    isMockCollab.value = true
    const wrapper = mount(PngtuberCollabCard, { props: { channel: 'default' } })
    const href = wrapper.find('a[href*="pngtuber-collab"]').attributes('href') ?? ''
    expect(href).toContain('mock=1')
    expect(href).not.toContain('room=')
    wrapper.unmount()
  })
})
