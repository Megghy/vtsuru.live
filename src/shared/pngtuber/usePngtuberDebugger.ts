import { onScopeDispose, ref, shallowRef } from 'vue'

import { createExpression, DEFAULT_PNGTUBER_STATE, type PngtuberState } from './types'
import type { CollabMemberItem } from './usePngtuberCollab'

function createMockAvatarSvg(color: string, label: string, mouthOpen: boolean): string {
  const mouthPath = mouthOpen
    ? `<ellipse cx="100" cy="115" rx="16" ry="12" fill="#e11d48"/>`
    : `<path d="M 86 112 Q 100 120 114 112" stroke="#475569" stroke-width="4" stroke-linecap="round" fill="none"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <circle cx="100" cy="95" r="60" fill="${color}" stroke="#0f172a" stroke-width="4"/>
    <ellipse cx="80" cy="85" rx="8" ry="10" fill="#0f172a"/>
    <ellipse cx="120" cy="85" rx="8" ry="10" fill="#0f172a"/>
    <circle cx="83" cy="82" r="3" fill="#ffffff"/>
    <circle cx="123" cy="82" r="3" fill="#ffffff"/>
    ${mouthPath}
    <rect x="50" y="165" width="100" height="24" rx="12" fill="#0f172a" opacity="0.8"/>
    <text x="100" y="181" fill="#ffffff" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">${label}</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function createMockPngtuberConfig(name: string, color: string, glowColor: string): PngtuberState {
  const idleSvg = createMockAvatarSvg(color, name, false)
  const talkSvg = createMockAvatarSvg(color, name, true)

  const s = structuredClone(DEFAULT_PNGTUBER_STATE)
  s.expressions = [
    {
      ...createExpression('默认', 'default'),
      idleImage: idleSvg,
      speakingImage: talkSvg,
    },
    {
      ...createExpression('开心', 'happy'),
      idleImage: idleSvg,
      speakingImage: talkSvg,
    },
  ]
  s.defaultExpressionId = 'default'
  s.speakingAnimation = 'bounce'
  s.idleAnimation = 'breathe'
  s.showGlow = true
  s.glowColor = glowColor
  s.canvasWidth = 320
  s.canvasHeight = 360
  s.padding = 16
  // 不走 normalizePngtuberState：它会清掉 data/blob 立绘，模拟预览必须保留内联 SVG
  return s
}

const PRESET_MOCK_MEMBERS = [
  { userId: 90001, name: '猫咪老师 (模拟)', color: '#38bdf8', glow: '#0284c7' },
  { userId: 90002, name: '可爱的南瓜 (模拟)', color: '#fb923c', glow: '#ea580c' },
]

const EXTRA_MOCK_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ec4899']

function mockMember(userId: number, name: string, config: PngtuberState, speaking = false): CollabMemberItem {
  return {
    userId,
    name,
    avatar: '',
    isSpeaking: speaking,
    volume: speaking ? 85 : 0,
    expressionId: speaking ? config.defaultExpressionId || '' : '',
    muted: false,
    away: false,
    config,
  }
}

export function usePngtuberDebugger() {
  const isSimulating = ref(false)
  const simulatedSpeaking = ref(false)
  const simulatedVolume = ref(0)
  const simulatedExpressionId = ref('')
  const simulatedMuted = ref(false)
  const simulatedAway = ref(false)
  const autoSpeakingWave = ref(false)

  const isMockCollab = ref(false)
  const mockMembers = shallowRef<CollabMemberItem[]>([])
  const autoCollabSpeaker = ref(false)

  let waveTimer: ReturnType<typeof setInterval> | null = null
  let collabCycleTimer: ReturnType<typeof setInterval> | null = null

  function clearTimer(timer: ReturnType<typeof setInterval> | null) {
    if (timer) clearInterval(timer)
    return null
  }

  function startSingleSimulation() {
    isSimulating.value = true
    simulatedSpeaking.value = false
    simulatedVolume.value = 0
  }

  function stopSingleSimulation() {
    isSimulating.value = false
    autoSpeakingWave.value = false
    waveTimer = clearTimer(waveTimer)
    simulatedSpeaking.value = false
    simulatedVolume.value = 0
    simulatedExpressionId.value = ''
    simulatedMuted.value = false
    simulatedAway.value = false
  }

  function toggleSingleSimulation() {
    if (isSimulating.value) stopSingleSimulation()
    else startSingleSimulation()
  }

  function setSimulatedSpeaking(val: boolean) {
    if (!isSimulating.value) isSimulating.value = true
    simulatedSpeaking.value = val
    simulatedVolume.value = val ? simulatedVolume.value || 75 : 0
  }

  function setSimulatedVolume(val: number) {
    if (!isSimulating.value) isSimulating.value = true
    const clamped = Math.max(0, Math.min(100, Math.round(val)))
    simulatedVolume.value = clamped
    simulatedSpeaking.value = clamped > 15 && !simulatedMuted.value && !simulatedAway.value
  }

  function toggleAutoWave() {
    if (!isSimulating.value) isSimulating.value = true
    autoSpeakingWave.value = !autoSpeakingWave.value
    if (autoSpeakingWave.value) {
      let step = 0
      waveTimer = clearTimer(waveTimer)
      waveTimer = setInterval(() => {
        step += 0.12
        const base = Math.sin(step) * 45 + 50
        const jitter = (Math.random() - 0.5) * 15
        const vol = Math.max(0, Math.min(100, Math.round(base + jitter)))
        simulatedVolume.value = vol
        simulatedSpeaking.value = vol > 25 && !simulatedMuted.value && !simulatedAway.value
      }, 60)
    } else {
      waveTimer = clearTimer(waveTimer)
      simulatedSpeaking.value = false
      simulatedVolume.value = 0
    }
  }

  function initMockCollabMembers(selfConfig?: PngtuberState): CollabMemberItem[] {
    const hostState = selfConfig
      ? structuredClone(selfConfig)
      : createMockPngtuberConfig('我 (当前立绘)', '#a855f7', '#9333ea')

    return [
      mockMember(90000, '我 (房主)', hostState, true),
      ...PRESET_MOCK_MEMBERS.map((preset) =>
        mockMember(preset.userId, preset.name, createMockPngtuberConfig(preset.name, preset.color, preset.glow)),
      ),
    ]
  }

  function startMockCollab(selfConfig?: PngtuberState) {
    isMockCollab.value = true
    mockMembers.value = initMockCollabMembers(selfConfig)
    startAutoCollabSpeaker()
  }

  function stopMockCollab() {
    isMockCollab.value = false
    autoCollabSpeaker.value = false
    collabCycleTimer = clearTimer(collabCycleTimer)
    mockMembers.value = []
  }

  function toggleMockCollab(selfConfig?: PngtuberState) {
    if (isMockCollab.value) stopMockCollab()
    else startMockCollab(selfConfig)
  }

  function cycleCollabSpeaker() {
    if (mockMembers.value.length === 0) return
    const currentActiveIdx = mockMembers.value.findIndex((m) => m.isSpeaking)
    const nextIdx = (currentActiveIdx + 1) % mockMembers.value.length

    mockMembers.value = mockMembers.value.map((m, idx) => {
      const isNowSpeaking = idx === nextIdx
      return {
        ...m,
        isSpeaking: isNowSpeaking,
        volume: isNowSpeaking ? Math.round(75 + Math.random() * 20) : 0,
      }
    })
  }

  function startAutoCollabSpeaker() {
    autoCollabSpeaker.value = true
    collabCycleTimer = clearTimer(collabCycleTimer)
    collabCycleTimer = setInterval(() => {
      cycleCollabSpeaker()
    }, 2800)
  }

  function toggleAutoCollabSpeaker() {
    if (autoCollabSpeaker.value) {
      autoCollabSpeaker.value = false
      collabCycleTimer = clearTimer(collabCycleTimer)
    } else {
      startAutoCollabSpeaker()
    }
  }

  function addMockMember() {
    const currentCount = mockMembers.value.length
    if (currentCount >= 6) return
    const color = EXTRA_MOCK_COLORS[currentCount % EXTRA_MOCK_COLORS.length]
    const name = `嘉宾 ${currentCount + 1} (模拟)`
    mockMembers.value = [
      ...mockMembers.value,
      mockMember(90000 + currentCount + 1, name, createMockPngtuberConfig(name, color, color)),
    ]
  }

  function removeMockMember(userId: number) {
    if (mockMembers.value.length <= 1) return
    mockMembers.value = mockMembers.value.filter((m) => m.userId !== userId)
  }

  function setMemberSpeaking(userId: number, isSpeaking: boolean, volume = 80) {
    mockMembers.value = mockMembers.value.map((m) =>
      m.userId === userId ? { ...m, isSpeaking, volume: isSpeaking ? volume : 0 } : m,
    )
  }

  onScopeDispose(() => {
    waveTimer = clearTimer(waveTimer)
    collabCycleTimer = clearTimer(collabCycleTimer)
  })

  return {
    isSimulating,
    simulatedSpeaking,
    simulatedVolume,
    simulatedExpressionId,
    simulatedMuted,
    simulatedAway,
    autoSpeakingWave,
    startSingleSimulation,
    stopSingleSimulation,
    toggleSingleSimulation,
    setSimulatedSpeaking,
    setSimulatedVolume,
    toggleAutoWave,
    isMockCollab,
    mockMembers,
    autoCollabSpeaker,
    startMockCollab,
    stopMockCollab,
    toggleMockCollab,
    cycleCollabSpeaker,
    toggleAutoCollabSpeaker,
    addMockMember,
    removeMockMember,
    setMemberSpeaking,
  }
}
