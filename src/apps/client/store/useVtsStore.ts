import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isTauri } from '@/shared/config'
import type { StoreTarget } from '@/apps/client/store/useTauriStore'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { ApiClient, VTubeStudioError } from 'vtubestudio'
import { nanoid } from 'nanoid'
import type {
  VtsHotkeyInfo,
  VtsStatisticsResponseData,
  VtsFaceFoundResponseData,
  VtsModelMovedEventData,
  VtsItemEventData,
  VtsAvailableItemFile,
  VtsItemInstance,
  VtsItemListResponseData,
  VtsItemLoadResponseData,
} from '@/apps/client/api/vts/messages'
import { svgUrlToPngBase64 } from '@/apps/client/api/vts/icon'

import pluginSvgUrl from '@/svgs/ic_vtuber.svg?url'

const PLUGIN_NAME = 'vtsuru'
const PLUGIN_DEVELOPER = 'Megghy'

const WS_URL_KEY = 'vts.wsUrl'
const AUTH_TOKEN_KEY = 'vts.authToken'
const PRESETS_KEY = 'vts.presets'
const MACROS_KEY = 'vts.macros'
const PARAM_SLOTS_KEY = 'vts.paramSlots'
const PANIC_KEY = 'vts.panic'
const HOTKEY_CUSTOM_KEY = 'vts.hotkeyCustom'
const ACCESSORIES_KEY = 'vts.accessories'
const PRANKS_KEY = 'vts.pranks'
const HISTORY_KEY = 'vts.history'
const OBS_LINK_KEY = 'vts.obsLink'
const PROFILES_KEY = 'vts.profiles'
const CURRENT_PROFILE_KEY = 'vts.currentProfileId'

export interface VtsPanicConfig {
  calibrateHotkeyId: string
  resetPhysicsHotkeyId: string
}

export interface VtsObsLinkConfig {
  enabled: boolean
  debounceMs: number
  sceneToPresetId: Record<string, string>
}

export interface VtsProfileData {
  hotkeyCustomizations: VtsHotkeyCustomization[]
  presets: VtsPreset[]
  macros: VtsMacro[]
  paramSlots: VtsParamSlot[]
  panic: VtsPanicConfig
  obsLink: VtsObsLinkConfig
  accessories: VtsAccessoryBinding[]
  pranks: VtsPrankBinding[]
}

export interface VtsProfile {
  id: string
  name: string
  data: VtsProfileData
}

export interface VtsProfileExportV1 {
  version: 1
  name: string
  data: VtsProfileData
}

export interface VtsHotkeyCustomization {
  hotkeyID: string
  favorite: boolean
  pinned?: boolean
  group?: string
  color?: string
  iconDataUrl?: string
  displayName?: string
}

export interface VtsAccessoryBinding {
  id: string
  name: string
  itemInstanceID: string
  visible: boolean
}

export interface VtsPrankBinding {
  id: string
  name: string
  fileName: string
  hotkeyID?: string
}

export type VtsOpKind =
  | 'connect'
  | 'disconnect'
  | 'authToken'
  | 'authenticate'
  | 'apiState'
  | 'hotkeys'
  | 'hotkeyTrigger'
  | 'moveModel'
  | 'injectParam'
  | 'itemList'
  | 'itemLoad'
  | 'itemUnload'
  | 'itemOpacity'
  | 'dropItem'
  | 'panicCalibrate'
  | 'panicResetPhysics'
  | 'macroRun'

export interface VtsOpRecord {
  id: string
  ts: number
  kind: VtsOpKind
  ok: boolean
  detail?: string
  durationMs?: number
  error?: string
  errorCode?: string
  payload?: unknown
}

export interface VtsPreset {
  id: string
  name: string
  timeInSeconds: number
  positionX: number
  positionY: number
  rotation: number
  size: number
}

export type VtsMacroStep =
  | { type: 'hotkey', hotkeyID: string }
  | { type: 'preset', presetId: string }
  | { type: 'wait', seconds: number }
  | { type: 'injectParam', parameterId: string, value: number, weight?: number }
  | { type: 'accessory', accessoryId: string, visible: boolean }
  | { type: 'prank', prankId: string }
  | { type: 'playAudio', url: string, volume?: number, waitForEnd?: boolean }

export interface VtsMacro {
  id: string
  name: string
  steps: VtsMacroStep[]
}

export interface VtsParamSlot {
  id: string
  name: string
  parameterId: string
  min: number
  max: number
  step: number
  weight: number
  value: number
  hold: boolean
}

export interface VtsMinimalExportV1 {
  version: 1
  wsUrl: string
  authToken: string
}

export interface VtsExportV2 {
  version: 2
  wsUrl: string
  authToken: string
  hotkeyCustomizations: VtsHotkeyCustomization[]
  presets: VtsPreset[]
  macros: VtsMacro[]
  paramSlots: VtsParamSlot[]
  panic: VtsPanicConfig
  obsLink?: VtsObsLinkConfig
  accessories: VtsAccessoryBinding[]
  pranks: VtsPrankBinding[]
}

export const useVtsStore = defineStore('vts', () => {
  const tauriStore = useTauriStore()
  const wsUrlTarget: StoreTarget<string> = tauriStore.getTarget(WS_URL_KEY, 'ws://127.0.0.1:8001')
  const authTokenTarget: StoreTarget<string> = tauriStore.getTarget(AUTH_TOKEN_KEY, '')
  const presetsTarget: StoreTarget<VtsPreset[]> = tauriStore.getTarget(PRESETS_KEY, [
    { id: 'preset-talk', name: '杂谈模式', timeInSeconds: 0.2, positionX: 0, positionY: 0, rotation: 0, size: 0 },
    { id: 'preset-game', name: '游戏模式', timeInSeconds: 0.2, positionX: 0.7, positionY: -0.6, rotation: 0, size: -20 },
    { id: 'preset-closeup', name: '特写模式', timeInSeconds: 0.2, positionX: 0, positionY: 0, rotation: 0, size: 30 },
  ])
  const macrosTarget: StoreTarget<VtsMacro[]> = tauriStore.getTarget(MACROS_KEY, [])
  const paramSlotsTarget: StoreTarget<VtsParamSlot[]> = tauriStore.getTarget(PARAM_SLOTS_KEY, [
    { id: 'slot-blush', name: 'Blush', parameterId: 'Blush', min: 0, max: 1, step: 0.01, weight: 1, value: 0, hold: false },
    { id: 'slot-pale', name: 'Pale', parameterId: 'Pale', min: 0, max: 1, step: 0.01, weight: 1, value: 0, hold: false },
    { id: 'slot-bodyy', name: 'Body_Y', parameterId: 'Body_Y', min: -1, max: 1, step: 0.01, weight: 1, value: 0, hold: false },
    { id: 'slot-eyeopen', name: 'EyeOpen', parameterId: 'EyeOpen', min: 0, max: 1, step: 0.01, weight: 1, value: 0, hold: false },
    { id: 'slot-mouthopen', name: 'MouthOpen', parameterId: 'MouthOpen', min: 0, max: 1, step: 0.01, weight: 1, value: 0, hold: false },
  ])
  const panicTarget: StoreTarget<VtsPanicConfig> = tauriStore.getTarget(PANIC_KEY, {
    calibrateHotkeyId: '',
    resetPhysicsHotkeyId: '',
  })
  const hotkeyCustomTarget: StoreTarget<VtsHotkeyCustomization[]> = tauriStore.getTarget(HOTKEY_CUSTOM_KEY, [])
  const accessoriesTarget: StoreTarget<VtsAccessoryBinding[]> = tauriStore.getTarget(ACCESSORIES_KEY, [])
  const pranksTarget: StoreTarget<VtsPrankBinding[]> = tauriStore.getTarget(PRANKS_KEY, [])
  const historyTarget: StoreTarget<VtsOpRecord[]> = tauriStore.getTarget(HISTORY_KEY, [])
  const obsLinkTarget: StoreTarget<VtsObsLinkConfig> = tauriStore.getTarget(OBS_LINK_KEY, {
    enabled: false,
    debounceMs: 150,
    sceneToPresetId: {},
  })
  const profilesTarget: StoreTarget<VtsProfile[]> = tauriStore.getTarget(PROFILES_KEY, [])
  const currentProfileIdTarget: StoreTarget<string> = tauriStore.getTarget(CURRENT_PROFILE_KEY, '')

  const wsUrl = ref('ws://127.0.0.1:8001')
  const authToken = ref('')

  const client = ref<ApiClient | null>(null)
  const connecting = ref(false)
  const connected = ref(false)
  const authenticated = ref(false)
  const apiVersion = ref<string | null>(null)
  const apiActive = ref<boolean | null>(null)
  const lastRttMs = ref<number | null>(null)
  const statistics = ref<VtsStatisticsResponseData | null>(null)
  const monitorLastError = ref<string | null>(null)

  const faceFound = ref<boolean | null>(null)
  const leftHandFound = ref<boolean | null>(null)
  const rightHandFound = ref<boolean | null>(null)
  const subscribedEvents = ref<string[]>([])
  const currentModelTransform = ref<VtsModelMovedEventData['modelPosition'] | null>(null)
  const lastItemEvent = ref<VtsItemEventData | null>(null)
  const itemEventWaiters = new Map<string, { resolve: (data: VtsItemEventData) => void, acceptTypes?: Set<string> }>()
  let monitorTimer: number | null = null

  const currentModelLoaded = ref<boolean | null>(null)
  const currentModelName = ref<string | null>(null)
  const currentModelId = ref<string | null>(null)
  const hotkeys = ref<VtsHotkeyInfo[]>([])

  const presets = ref<VtsPreset[]>([])
  const macros = ref<VtsMacro[]>([])
  const paramSlots = ref<VtsParamSlot[]>([])
  const holdTimerBySlotId = new Map<string, number>()
  const panicConfig = ref<VtsPanicConfig>({ calibrateHotkeyId: '', resetPhysicsHotkeyId: '' })

  const hotkeyCustomizations = ref<VtsHotkeyCustomization[]>([])
  const accessories = ref<VtsAccessoryBinding[]>([])
  const pranks = ref<VtsPrankBinding[]>([])

  const canLoadItems = ref<boolean | null>(null)
  const itemInstancesInScene = ref<VtsItemInstance[]>([])
  const availableItemFiles = ref<VtsAvailableItemFile[]>([])

  const history = ref<VtsOpRecord[]>([])

  const lastError = ref<string | null>(null)

  const canOperate = computed(() => connected.value && authenticated.value)

  const obsLinkConfig = ref<VtsObsLinkConfig>({ enabled: false, debounceMs: 150, sceneToPresetId: {} })
  const profiles = ref<VtsProfile[]>([])
  const currentProfileId = ref<string>('')

  async function init() {
    if (!isTauri()) {
      throw new Error('仅支持在 Tauri 环境使用 VTS 控制')
    }
    wsUrl.value = (await wsUrlTarget.get()) ?? 'ws://127.0.0.1:8001'
    authToken.value = (await authTokenTarget.get()) ?? ''
    presets.value = (await presetsTarget.get()) ?? []
    macros.value = (await macrosTarget.get()) ?? []
    paramSlots.value = (await paramSlotsTarget.get()) ?? []
    panicConfig.value = (await panicTarget.get()) ?? { calibrateHotkeyId: '', resetPhysicsHotkeyId: '' }
    hotkeyCustomizations.value = (await hotkeyCustomTarget.get()) ?? []
    accessories.value = (await accessoriesTarget.get()) ?? []
    pranks.value = (await pranksTarget.get()) ?? []
    history.value = (await historyTarget.get()) ?? []
    obsLinkConfig.value = (await obsLinkTarget.get()) ?? { enabled: false, debounceMs: 150, sceneToPresetId: {} }
    profiles.value = (await profilesTarget.get()) ?? []
    currentProfileId.value = (await currentProfileIdTarget.get()) ?? ''
  }

  async function setWsUrl(next: string) {
    wsUrl.value = next.trim()
    await wsUrlTarget.set(wsUrl.value)
  }

  async function clearAuthToken() {
    authToken.value = ''
    await authTokenTarget.set('')
    authenticated.value = false
  }

  function exportMinimalConfig(): VtsMinimalExportV1 {
    return {
      version: 1,
      wsUrl: wsUrl.value,
      authToken: authToken.value,
    }
  }

  async function importMinimalConfig(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('导入失败：配置不是对象')
    }
    const p = payload as Partial<VtsMinimalExportV1>
    if (p.version !== 1) {
      throw new Error('导入失败：不支持的配置版本')
    }
    if (!p.wsUrl || typeof p.wsUrl !== 'string') {
      throw new Error('导入失败：wsUrl 无效')
    }
    if (p.authToken === undefined || typeof p.authToken !== 'string') {
      throw new Error('导入失败：authToken 无效')
    }

    await wsUrlTarget.set(p.wsUrl.trim())
    await authTokenTarget.set(p.authToken)
    await init()
  }

  function exportFullConfig(): VtsExportV2 {
    return {
      version: 2,
      wsUrl: wsUrl.value,
      authToken: authToken.value,
      hotkeyCustomizations: hotkeyCustomizations.value,
      presets: presets.value,
      macros: macros.value,
      paramSlots: paramSlots.value,
      panic: panicConfig.value,
      obsLink: obsLinkConfig.value,
      accessories: accessories.value,
      pranks: pranks.value,
    }
  }

  async function importFullConfig(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('导入失败：配置不是对象')
    }
    const p = payload as Partial<VtsExportV2>
    if (p.version !== 2) {
      throw new Error('导入失败：不支持的配置版本')
    }
    assertString(p.wsUrl, 'wsUrl')
    if (p.authToken === undefined || typeof p.authToken !== 'string') throw new Error('导入失败：authToken 无效')
    assertArray(p.hotkeyCustomizations, 'hotkeyCustomizations')
    assertArray(p.presets, 'presets')
    assertArray(p.macros, 'macros')
    assertArray(p.paramSlots, 'paramSlots')
    if (!p.panic || typeof p.panic !== 'object') throw new Error('导入失败：panic 无效')
    if (p.obsLink !== undefined && typeof p.obsLink !== 'object') throw new Error('导入失败：obsLink 无效')
    assertArray(p.accessories, 'accessories')
    assertArray(p.pranks, 'pranks')

    for (let i = 0; i < p.hotkeyCustomizations.length; i++) {
      const c = p.hotkeyCustomizations[i]
      assertRecord(c, `hotkeyCustomizations[${i}]`)
      assertString(c.hotkeyID, `hotkeyCustomizations[${i}].hotkeyID`)
      assertBoolean(c.favorite, `hotkeyCustomizations[${i}].favorite`)
      if (c.pinned !== undefined) assertBoolean(c.pinned, `hotkeyCustomizations[${i}].pinned`)
      if (c.group !== undefined && typeof c.group !== 'string') throw new Error(`导入失败：hotkeyCustomizations[${i}].group 无效`)
      if (c.color !== undefined && typeof c.color !== 'string') throw new Error(`导入失败：hotkeyCustomizations[${i}].color 无效`)
      if (c.iconDataUrl !== undefined && typeof c.iconDataUrl !== 'string') throw new Error(`导入失败：hotkeyCustomizations[${i}].iconDataUrl 无效`)
      if (c.displayName !== undefined && typeof c.displayName !== 'string') throw new Error(`导入失败：hotkeyCustomizations[${i}].displayName 无效`)
    }

    for (let i = 0; i < p.presets.length; i++) {
      const pr = p.presets[i] as unknown
      assertRecord(pr, `presets[${i}]`)
      assertString(pr.id, `presets[${i}].id`)
      assertString(pr.name, `presets[${i}].name`)
      assertNumber(pr.timeInSeconds, `presets[${i}].timeInSeconds`)
      assertNumber(pr.positionX, `presets[${i}].positionX`)
      assertNumber(pr.positionY, `presets[${i}].positionY`)
      assertNumber(pr.rotation, `presets[${i}].rotation`)
      assertNumber(pr.size, `presets[${i}].size`)
    }

    for (let i = 0; i < p.macros.length; i++) {
      const m = p.macros[i] as unknown
      assertRecord(m, `macros[${i}]`)
      assertString(m.id, `macros[${i}].id`)
      assertString(m.name, `macros[${i}].name`)
      assertArray(m.steps, `macros[${i}].steps`)
      for (let j = 0; j < m.steps.length; j++) {
        const step = m.steps[j]
        assertRecord(step, `macros[${i}].steps[${j}]`)
        assertString(step.type, `macros[${i}].steps[${j}].type`)
        if (step.type === 'hotkey') {
          assertString(step.hotkeyID, `macros[${i}].steps[${j}].hotkeyID`)
          continue
        }
        if (step.type === 'preset') {
          assertString(step.presetId, `macros[${i}].steps[${j}].presetId`)
          continue
        }
        if (step.type === 'wait') {
          assertNumber(step.seconds, `macros[${i}].steps[${j}].seconds`)
          if (step.seconds < 0) throw new Error(`导入失败：macros[${i}].steps[${j}].seconds 无效`)
          continue
        }
        if (step.type === 'injectParam') {
          assertString(step.parameterId, `macros[${i}].steps[${j}].parameterId`)
          assertNumber(step.value, `macros[${i}].steps[${j}].value`)
          if (step.weight !== undefined) assertNumber(step.weight, `macros[${i}].steps[${j}].weight`)
          continue
        }
        if (step.type === 'accessory') {
          assertString(step.accessoryId, `macros[${i}].steps[${j}].accessoryId`)
          assertBoolean(step.visible, `macros[${i}].steps[${j}].visible`)
          continue
        }
        if (step.type === 'prank') {
          assertString(step.prankId, `macros[${i}].steps[${j}].prankId`)
          continue
        }
        if (step.type === 'playAudio') {
          assertString(step.url, `macros[${i}].steps[${j}].url`)
          if (step.volume !== undefined) {
            assertNumber(step.volume, `macros[${i}].steps[${j}].volume`)
            if (step.volume < 0 || step.volume > 1) throw new Error(`导入失败：macros[${i}].steps[${j}].volume 无效`)
          }
          if (step.waitForEnd !== undefined) assertBoolean(step.waitForEnd, `macros[${i}].steps[${j}].waitForEnd`)
          continue
        }
        throw new Error(`导入失败：macros[${i}].steps[${j}].type 不支持`)
      }
    }

    for (let i = 0; i < p.paramSlots.length; i++) {
      const s = p.paramSlots[i] as unknown
      assertRecord(s, `paramSlots[${i}]`)
      assertString(s.id, `paramSlots[${i}].id`)
      assertString(s.name, `paramSlots[${i}].name`)
      assertString(s.parameterId, `paramSlots[${i}].parameterId`)
      assertNumber(s.min, `paramSlots[${i}].min`)
      assertNumber(s.max, `paramSlots[${i}].max`)
      assertNumber(s.step, `paramSlots[${i}].step`)
      assertNumber(s.weight, `paramSlots[${i}].weight`)
      assertNumber(s.value, `paramSlots[${i}].value`)
      assertBoolean(s.hold, `paramSlots[${i}].hold`)
    }

    assertRecord(p.panic, 'panic')
    if (typeof (p.panic as any).calibrateHotkeyId !== 'string') throw new Error('导入失败：panic.calibrateHotkeyId 无效')
    if (typeof (p.panic as any).resetPhysicsHotkeyId !== 'string') throw new Error('导入失败：panic.resetPhysicsHotkeyId 无效')

    if (p.obsLink) {
      assertRecord(p.obsLink, 'obsLink')
      assertBoolean((p.obsLink as any).enabled, 'obsLink.enabled')
      assertNumber((p.obsLink as any).debounceMs, 'obsLink.debounceMs')
      assertRecord((p.obsLink as any).sceneToPresetId, 'obsLink.sceneToPresetId')
      for (const [k, v] of Object.entries((p.obsLink as any).sceneToPresetId as Record<string, unknown>)) {
        if (typeof k !== 'string' || typeof v !== 'string') throw new Error('导入失败：obsLink.sceneToPresetId 无效')
      }
    }

    for (let i = 0; i < p.accessories.length; i++) {
      const a = p.accessories[i] as unknown
      assertRecord(a, `accessories[${i}]`)
      assertString(a.id, `accessories[${i}].id`)
      assertString(a.name, `accessories[${i}].name`)
      if (typeof a.itemInstanceID !== 'string') throw new Error(`导入失败：accessories[${i}].itemInstanceID 无效`)
      assertBoolean(a.visible, `accessories[${i}].visible`)
    }

    for (let i = 0; i < p.pranks.length; i++) {
      const pr = p.pranks[i] as unknown
      assertRecord(pr, `pranks[${i}]`)
      assertString(pr.id, `pranks[${i}].id`)
      assertString(pr.name, `pranks[${i}].name`)
      if (typeof pr.fileName !== 'string') throw new Error(`导入失败：pranks[${i}].fileName 无效`)
      if (pr.hotkeyID !== undefined && typeof pr.hotkeyID !== 'string') throw new Error(`导入失败：pranks[${i}].hotkeyID 无效`)
    }

    await wsUrlTarget.set(p.wsUrl.trim())
    await authTokenTarget.set(p.authToken)
    await hotkeyCustomTarget.set(p.hotkeyCustomizations)
    await presetsTarget.set(p.presets)
    await macrosTarget.set(p.macros)
    await paramSlotsTarget.set(p.paramSlots)
    await panicTarget.set(p.panic)
    if (p.obsLink) await obsLinkTarget.set(p.obsLink)
    await accessoriesTarget.set(p.accessories)
    await pranksTarget.set(p.pranks)
    await init()
  }

  function snapshotProfileData(): VtsProfileData {
    return {
      hotkeyCustomizations: hotkeyCustomizations.value,
      presets: presets.value,
      macros: macros.value,
      paramSlots: paramSlots.value,
      panic: panicConfig.value,
      obsLink: obsLinkConfig.value,
      accessories: accessories.value,
      pranks: pranks.value,
    }
  }

  async function createProfile(name = '新 Profile') {
    const profile: VtsProfile = {
      id: `profile-${nanoid(8)}`,
      name,
      data: snapshotProfileData(),
    }
    const list = [profile, ...profiles.value]
    profiles.value = list
    await profilesTarget.set(list)
    return profile
  }

  async function updateProfile(next: VtsProfile) {
    const list = profiles.value.slice()
    const idx = list.findIndex(p => p.id === next.id)
    if (idx < 0) throw new Error('Profile 不存在')
    list[idx] = next
    profiles.value = list
    await profilesTarget.set(list)
  }

  async function deleteProfile(id: string) {
    const list = profiles.value.filter(p => p.id !== id)
    profiles.value = list
    await profilesTarget.set(list)
    if (currentProfileId.value === id) {
      currentProfileId.value = ''
      await currentProfileIdTarget.set('')
    }
  }

  async function applyProfile(id: string) {
    const profile = profiles.value.find(p => p.id === id)
    if (!profile) throw new Error('Profile 不存在')

    await hotkeyCustomTarget.set(profile.data.hotkeyCustomizations)
    await presetsTarget.set(profile.data.presets)
    await macrosTarget.set(profile.data.macros)
    await paramSlotsTarget.set(profile.data.paramSlots)
    await panicTarget.set(profile.data.panic)
    await obsLinkTarget.set(profile.data.obsLink)
    await accessoriesTarget.set(profile.data.accessories)
    await pranksTarget.set(profile.data.pranks)

    currentProfileId.value = id
    await currentProfileIdTarget.set(id)
    await init()
  }

  async function captureCurrentToProfile(id: string) {
    const profile = profiles.value.find(p => p.id === id)
    if (!profile) throw new Error('Profile 不存在')
    await updateProfile({ ...profile, data: snapshotProfileData() })
  }

  function exportProfile(id: string): VtsProfileExportV1 {
    const profile = profiles.value.find(p => p.id === id)
    if (!profile) throw new Error('Profile 不存在')
    return {
      version: 1,
      name: profile.name,
      data: profile.data,
    }
  }

  function assertArray(value: unknown, label: string): asserts value is unknown[] {
    if (!Array.isArray(value)) throw new Error(`导入失败：${label} 无效`)
  }

  function assertString(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`导入失败：${label} 无效`)
  }

  function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`导入失败：${label} 无效`)
  }

  function assertBoolean(value: unknown, label: string): asserts value is boolean {
    if (typeof value !== 'boolean') throw new Error(`导入失败：${label} 无效`)
  }

  function assertNumber(value: unknown, label: string): asserts value is number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`导入失败：${label} 无效`)
  }

  async function importProfile(payload: unknown) {
    if (!payload || typeof payload !== 'object') throw new Error('导入失败：Profile 不是对象')
    const p = payload as Partial<VtsProfileExportV1>
    if (p.version !== 1) throw new Error('导入失败：不支持的 Profile 版本')
    assertString(p.name, 'name')
    if (!p.data || typeof p.data !== 'object') throw new Error('导入失败：data 无效')

    const data = p.data as Partial<VtsProfileData>
    assertArray(data.hotkeyCustomizations, 'hotkeyCustomizations')
    assertArray(data.presets, 'presets')
    assertArray(data.macros, 'macros')
    assertArray(data.paramSlots, 'paramSlots')
    if (!data.panic || typeof data.panic !== 'object') throw new Error('导入失败：panic 无效')
    if (!data.obsLink || typeof data.obsLink !== 'object') throw new Error('导入失败：obsLink 无效')
    assertArray(data.accessories, 'accessories')
    assertArray(data.pranks, 'pranks')

    const name = p.name.trim()
    if (profiles.value.some(pr => pr.name === name)) {
      throw new Error('导入失败：已存在同名 Profile（请先重命名或删除）')
    }

    const profile: VtsProfile = {
      id: `profile-${nanoid(8)}`,
      name,
      data: data as VtsProfileData,
    }
    const list = [profile, ...profiles.value]
    profiles.value = list
    await profilesTarget.set(list)
    return profile
  }

  function pushHistoryRecord(next: Omit<VtsOpRecord, 'id' | 'ts'> & { id?: string, ts?: number }) {
    const record: VtsOpRecord = {
      id: next.id ?? `vtsop-${nanoid(10)}`,
      ts: next.ts ?? Date.now(),
      kind: next.kind,
      ok: next.ok,
      detail: next.detail,
      durationMs: next.durationMs,
      error: next.error,
      errorCode: next.errorCode,
      payload: next.payload,
    }
    const list = [record, ...history.value].slice(0, 200)
    history.value = list
    void historyTarget.set(list)
  }

  function normalizeOpError(err: unknown): { error: string, errorCode?: string } {
    if (err instanceof VTubeStudioError) {
      const errorID = (err.data as any)?.errorID
      if ((typeof errorID === 'number' || typeof errorID === 'string') && String(errorID)) {
        return { error: err.message, errorCode: `VTS_API:${String(errorID)}` }
      }
      return { error: err.message, errorCode: 'VTS_API:UNKNOWN' }
    }
    if (err instanceof Error) {
      const msg = err.message || String(err)
      if (msg.includes('WebSocket')) return { error: msg, errorCode: 'WS' }
      return { error: msg }
    }
    return { error: String(err), errorCode: 'UNKNOWN' }
  }

  async function withHistory<T>(kind: VtsOpKind, detail: string | undefined, fn: () => Promise<T>, payload?: unknown) {
    const started = Date.now()
    try {
      const result = await fn()
      pushHistoryRecord({ kind, ok: true, detail, durationMs: Date.now() - started, payload })
      return result
    } catch (err) {
      const normalized = normalizeOpError(err)
      pushHistoryRecord({
        kind,
        ok: false,
        detail,
        durationMs: Date.now() - started,
        error: normalized.error,
        errorCode: normalized.errorCode,
        payload,
      })
      throw err
    }
  }

  async function clearHistory() {
    history.value = []
    await historyTarget.set([])
  }

  function isRecordObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object'
  }

  async function replayHistoryRecord(recordId: string) {
    const record = history.value.find(r => r.id === recordId)
    if (!record) throw new Error('历史记录不存在')
    if (!record.payload) throw new Error('该历史记录不支持回放（缺少 payload）')

    const payload = record.payload

    if (record.kind === 'hotkeyTrigger') {
      if (!isRecordObject(payload) || typeof payload.hotkeyID !== 'string') throw new Error('回放数据无效：hotkeyID')
      await triggerHotkey(payload.hotkeyID)
      return
    }

    if (record.kind === 'moveModel') {
      if (!isRecordObject(payload)) throw new Error('回放数据无效：moveModel payload')
      const timeInSeconds = payload.timeInSeconds
      const positionX = payload.positionX
      const positionY = payload.positionY
      const rotation = payload.rotation
      const size = payload.size
      if (![timeInSeconds, positionX, positionY, rotation, size].every(v => typeof v === 'number' && Number.isFinite(v))) {
        throw new Error('回放数据无效：moveModel 数值')
      }
      await moveModel({
        timeInSeconds: timeInSeconds as number,
        positionX: positionX as number,
        positionY: positionY as number,
        rotation: rotation as number,
        size: size as number,
      })
      return
    }

    if (record.kind === 'injectParam') {
      if (!isRecordObject(payload) || !Array.isArray((payload as any).values)) throw new Error('回放数据无效：injectParam values')
      const values = (payload as any).values as Array<{ id: unknown, value: unknown, weight?: unknown }>
      const normalized = values.map((v) => {
        if (typeof v.id !== 'string') throw new Error('回放数据无效：parameter id')
        if (typeof v.value !== 'number' || !Number.isFinite(v.value)) throw new Error('回放数据无效：parameter value')
        if (v.weight != null && (typeof v.weight !== 'number' || !Number.isFinite(v.weight))) throw new Error('回放数据无效：parameter weight')
        return { id: v.id, value: v.value, weight: v.weight as number | undefined }
      })
      await injectParametersAdd(normalized)
      return
    }

    if (record.kind === 'macroRun') {
      if (!isRecordObject(payload) || typeof payload.macroId !== 'string') throw new Error('回放数据无效：macroId')
      await runMacro(payload.macroId)
      return
    }

    if (record.kind === 'itemOpacity') {
      if (!isRecordObject(payload) || typeof payload.itemInstanceID !== 'string') throw new Error('回放数据无效：itemInstanceID')
      if (typeof payload.opacity !== 'number' || !Number.isFinite(payload.opacity)) throw new Error('回放数据无效：opacity')
      await setItemOpacity(payload.itemInstanceID, payload.opacity)
      return
    }

    if (record.kind === 'dropItem') {
      if (!isRecordObject(payload) || typeof payload.fileName !== 'string') throw new Error('回放数据无效：fileName')
      const x = payload.x
      const size = payload.size
      if (![x, size].every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('回放数据无效：dropItem 数值')
      await dropItem(payload.fileName, { x: x as number, size: size as number })
      return
    }

    if (record.kind === 'panicCalibrate' || record.kind === 'panicResetPhysics') {
      if (!isRecordObject(payload) || typeof payload.hotkeyID !== 'string') throw new Error('回放数据无效：panic hotkeyID')
      await triggerHotkey(payload.hotkeyID)
      return
    }

    throw new Error(`该历史记录不支持回放: ${record.kind}`)
  }

  async function subscribeDefaultEvents() {
    if (!client.value) throw new Error('未连接到 VTS')
    if (!authenticated.value) return

    await client.value.events.trackingStatusChanged.subscribe((data) => {
      faceFound.value = data.faceFound
      leftHandFound.value = data.leftHandFound
      rightHandFound.value = data.rightHandFound
    })

    await client.value.events.modelLoaded.subscribe((data) => {
      currentModelLoaded.value = data.modelLoaded
      currentModelName.value = data.modelName
      currentModelId.value = data.modelID
      currentModelTransform.value = null
      if (!data.modelLoaded) {
        hotkeys.value = []
        return
      }
      void refreshHotkeys().catch((err) => {
        lastError.value = err instanceof Error ? err.message : String(err)
      })
    }, {})

    await client.value.events.modelMoved.subscribe((data) => {
      currentModelTransform.value = data.modelPosition
    })

    await client.value.events.item.subscribe((data) => {
      const normalized = data as any as VtsItemEventData
      lastItemEvent.value = normalized
      const waiter = itemEventWaiters.get(normalized.itemInstanceID)
      if (waiter) {
        if (!waiter.acceptTypes || waiter.acceptTypes.has(normalized.itemEventType)) {
          waiter.resolve(normalized)
        }
      }
    }, {})

    subscribedEvents.value = [
      'TrackingStatusChangedEvent',
      'ModelLoadedEvent',
      'ModelMovedEvent',
      'ItemEvent',
    ]
  }

  async function waitForItemEvent(itemInstanceID: string, acceptTypes: string[], timeoutMs: number) {
    const accept = new Set(acceptTypes)
    return new Promise<VtsItemEventData | null>((resolve) => {
      const timer = window.setTimeout(() => {
        itemEventWaiters.delete(itemInstanceID)
        resolve(null)
      }, timeoutMs)
      itemEventWaiters.set(itemInstanceID, {
        acceptTypes: accept,
        resolve: (data) => {
          clearTimeout(timer)
          itemEventWaiters.delete(itemInstanceID)
          resolve(data)
        },
      })
    })
  }

  async function refreshStatistics() {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const started = performance.now()
    const data = await client.value.statistics()
    lastRttMs.value = Math.round(performance.now() - started)
    statistics.value = data as any as VtsStatisticsResponseData
  }

  async function refreshFaceFound() {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const started = performance.now()
    const data = await client.value.faceFound()
    lastRttMs.value = Math.round(performance.now() - started)
    faceFound.value = (data as any as VtsFaceFoundResponseData).found
  }

  async function pollMonitorOnce() {
    if (!connected.value || !client.value) return
    try {
      monitorLastError.value = null
      await refreshStatistics()
      await refreshFaceFound()
    } catch (err) {
      monitorLastError.value = err instanceof Error ? err.message : String(err)
    }
  }

  function startMonitor() {
    if (monitorTimer != null) return
    monitorTimer = window.setInterval(() => {
      void pollMonitorOnce()
    }, 1000)
    void pollMonitorOnce()
  }

  function stopMonitor() {
    if (monitorTimer != null) {
      clearInterval(monitorTimer)
      monitorTimer = null
    }
    monitorLastError.value = null
    statistics.value = null
  }

  async function connect() {
    if (!isTauri()) {
      throw new Error('仅支持在 Tauri 环境使用 VTS 控制')
    }
    if (connecting.value) return

    connecting.value = true
    lastError.value = null

    try {
      const iconBase64 = await svgUrlToPngBase64(pluginSvgUrl, 128)
      const apiClient = new ApiClient({
        url: wsUrl.value,
        pluginName: PLUGIN_NAME,
        pluginDeveloper: PLUGIN_DEVELOPER,
        pluginIcon: iconBase64,
        authTokenGetter: () => authToken.value || null,
        authTokenSetter: async (token) => {
          authToken.value = token
          await authTokenTarget.set(token)
        },
      })

      apiClient.on('connect', () => {
        connected.value = true
        void refreshApiState().catch((err) => {
          lastError.value = err instanceof Error ? err.message : String(err)
        })
        void refreshHotkeys().catch((err) => {
          lastError.value = err instanceof Error ? err.message : String(err)
        })
        startMonitor()
      })
      apiClient.on('disconnect', () => {
        connected.value = false
        authenticated.value = false
        stopMonitor()
      })
      apiClient.on('error', (err) => {
        lastError.value = err instanceof Error ? err.message : String(err)
      })

      client.value = apiClient

      await withHistory('connect', wsUrl.value, async () => {
        if (apiClient.isConnected) return
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup()
            reject(new Error('连接 VTS 超时（等待 connect 事件）'))
          }, 6 * 60 * 1000)

          const onConnect = () => {
            cleanup()
            resolve()
          }
          const onError = (err: unknown) => {
            cleanup()
            reject(err instanceof Error ? err : new Error(String(err)))
          }

          const cleanup = () => {
            window.clearTimeout(timeout)
            apiClient.off('connect', onConnect)
            apiClient.off('error', onError)
          }

          apiClient.on('connect', onConnect)
          apiClient.on('error', onError)
        })
      })

      await refreshApiState()
      if (!authenticated.value) {
        await authenticate()
      }
      await subscribeDefaultEvents()
      startMonitor()
    } catch (err) {
      connected.value = false
      authenticated.value = false
      await client.value?.disconnect()
      client.value = null
      lastError.value = err instanceof Error ? err.message : String(err)
      stopMonitor()
      throw err
    } finally {
      connecting.value = false
    }
  }

  async function disconnect() {
    stopAllParamHolds()
    stopMonitor()
    await withHistory('disconnect', undefined, async () => {
      await client.value?.disconnect()
    })
    client.value = null
    connected.value = false
    authenticated.value = false
    apiVersion.value = null
    apiActive.value = null
    subscribedEvents.value = []
    faceFound.value = null
    leftHandFound.value = null
    rightHandFound.value = null
    currentModelTransform.value = null
    lastItemEvent.value = null
    itemEventWaiters.clear()
  }

  async function requestAuthenticationToken() {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const c = client.value
    const iconBase64 = await svgUrlToPngBase64(pluginSvgUrl, 128)
    const data = await withHistory('authToken', PLUGIN_NAME, async () => c.authenticationToken({
      pluginName: PLUGIN_NAME,
      pluginDeveloper: PLUGIN_DEVELOPER,
      pluginIcon: iconBase64,
    }))
    const token = data.authenticationToken

    authToken.value = token
    await authTokenTarget.set(token)
    return token
  }

  async function authenticate() {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const c = client.value
    if (!authToken.value) {
      throw new Error('尚未获取 authenticationToken')
    }

    const started = performance.now()
    const data = await withHistory('authenticate', undefined, async () => c.authentication({
      pluginName: PLUGIN_NAME,
      pluginDeveloper: PLUGIN_DEVELOPER,
      authenticationToken: authToken.value,
    }))
    lastRttMs.value = Math.round(performance.now() - started)
    if (!data.authenticated) throw new Error(`鉴权失败：${data.reason}`)

    await refreshApiState()
    if (authenticated.value) {
      await subscribeDefaultEvents()
      startMonitor()
    }
  }

  async function refreshApiState() {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const c = client.value
    const started = performance.now()
    const data = await withHistory('apiState', undefined, async () => c.apiState())
    lastRttMs.value = Math.round(performance.now() - started)
    apiActive.value = data.active
    apiVersion.value = data.vTubeStudioVersion
    authenticated.value = data.currentSessionAuthenticated
  }

  async function refreshHotkeys() {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const c = client.value
    const started = performance.now()
    const data = await withHistory('hotkeys', undefined, async () => c.hotkeysInCurrentModel({}))
    lastRttMs.value = Math.round(performance.now() - started)
    currentModelLoaded.value = data.modelLoaded
    currentModelName.value = data.modelName
    currentModelId.value = data.modelID
    hotkeys.value = (data.availableHotkeys ?? []).map((h) => {
      if (!Array.isArray((h as any).keyCombination)) {
        throw new TypeError('Hotkey keyCombination 无效')
      }
      return {
        ...(h as any),
        keyCombination: (h as any).keyCombination.map((k: unknown) => String(k)),
      } as VtsHotkeyInfo
    })
  }

  async function triggerHotkey(hotkeyID: string) {
    if (!client.value) {
      throw new Error('未连接到 VTS')
    }
    const c = client.value
    if (!authenticated.value) {
      throw new Error('未完成鉴权')
    }
    const started = performance.now()
    await withHistory('hotkeyTrigger', hotkeyID, async () => c.hotkeyTrigger({ hotkeyID }), { hotkeyID })
    lastRttMs.value = Math.round(performance.now() - started)
  }

  async function moveModel(preset: Pick<VtsPreset, 'timeInSeconds' | 'positionX' | 'positionY' | 'rotation' | 'size'>) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    const payload = {
      timeInSeconds: preset.timeInSeconds,
      positionX: preset.positionX,
      positionY: preset.positionY,
      rotation: preset.rotation,
      size: preset.size,
    }
    const started = performance.now()
    await withHistory('moveModel', undefined, async () => c.moveModel({
      timeInSeconds: preset.timeInSeconds,
      valuesAreRelativeToModel: false,
      positionX: preset.positionX,
      positionY: preset.positionY,
      rotation: preset.rotation,
      size: preset.size,
    }), payload)
    lastRttMs.value = Math.round(performance.now() - started)
  }

  async function upsertPreset(next: VtsPreset) {
    const list = presets.value.slice()
    const idx = list.findIndex(p => p.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    presets.value = list
    await presetsTarget.set(list)
  }

  async function removePreset(id: string) {
    const list = presets.value.filter(p => p.id !== id)
    presets.value = list
    await presetsTarget.set(list)
  }

  async function applyPreset(presetId: string) {
    const preset = presets.value.find(p => p.id === presetId)
    if (!preset) throw new Error('预设不存在')
    await moveModel(preset)
  }

  async function upsertMacro(next: VtsMacro) {
    const list = macros.value.slice()
    const idx = list.findIndex(m => m.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    macros.value = list
    await macrosTarget.set(list)
  }

  async function removeMacro(id: string) {
    const list = macros.value.filter(m => m.id !== id)
    macros.value = list
    await macrosTarget.set(list)
  }

  async function runMacro(macroId: string) {
    const macro = macros.value.find(m => m.id === macroId)
    if (!macro) throw new Error('宏不存在')
    if (!client.value) throw new Error('未连接到 VTS')
    if (!authenticated.value) throw new Error('未完成鉴权')

    await withHistory('macroRun', macroId, async () => {
      for (const step of macro.steps) {
        if (step.type === 'hotkey') {
          await triggerHotkey(step.hotkeyID)
          continue
        }
        if (step.type === 'preset') {
          await applyPreset(step.presetId)
          continue
        }
        if (step.type === 'wait') {
          if (!Number.isFinite(step.seconds) || step.seconds < 0) {
            throw new TypeError('宏步骤 wait.seconds 无效')
          }
          await new Promise<void>((r) => setTimeout(r, step.seconds * 1000))
          continue
        }
        if (step.type === 'injectParam') {
          await injectParametersAdd([{ id: step.parameterId, value: step.value, weight: step.weight }])
          continue
        }
        if (step.type === 'accessory') {
          if (typeof step.accessoryId !== 'string' || !step.accessoryId) {
            throw new TypeError('宏步骤 accessory.accessoryId 无效')
          }
          if (typeof step.visible !== 'boolean') {
            throw new TypeError('宏步骤 accessory.visible 无效')
          }
          await toggleAccessory(step.accessoryId, step.visible)
          continue
        }
        if (step.type === 'prank') {
          if (typeof step.prankId !== 'string' || !step.prankId) {
            throw new TypeError('宏步骤 prank.prankId 无效')
          }
          const prank = pranks.value.find(p => p.id === step.prankId)
          if (!prank) throw new Error('宏步骤 prank.prankId 不存在')
          if (prank.hotkeyID) {
            await triggerHotkey(prank.hotkeyID)
            continue
          }
          if (!prank.fileName) throw new Error('宏步骤 prank 未配置 fileName 或 hotkey')
          await dropItem(prank.fileName, { x: 0, size: 0.32 })
          continue
        }
        if (step.type === 'playAudio') {
          if (typeof step.url !== 'string' || !step.url) {
            throw new TypeError('宏步骤 playAudio.url 无效')
          }
          if (step.volume !== undefined && (!Number.isFinite(step.volume) || step.volume < 0 || step.volume > 1)) {
            throw new TypeError('宏步骤 playAudio.volume 无效')
          }
          if (step.waitForEnd !== undefined && typeof step.waitForEnd !== 'boolean') {
            throw new TypeError('宏步骤 playAudio.waitForEnd 无效')
          }
          const audio = new Audio(step.url)
          if (step.volume !== undefined) audio.volume = step.volume
          await audio.play()
          if (step.waitForEnd) {
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => resolve()
              audio.onerror = () => reject(new Error('音效播放失败'))
            })
          }
          continue
        }
        throw new Error(`未知宏步骤类型: ${(step as any).type}`)
      }
    }, { macroId })
  }

  async function injectParametersAdd(values: Array<{ id: string, value: number, weight?: number }>) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    if (values.length === 0) return

    const started = performance.now()
    await withHistory('injectParam', values.map(v => v.id).join(','), async () => c.injectParameterData({
      mode: 'add',
      parameterValues: values,
    }), { values })
    lastRttMs.value = Math.round(performance.now() - started)
  }

  async function upsertParamSlot(next: VtsParamSlot) {
    const list = paramSlots.value.slice()
    const idx = list.findIndex(s => s.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    paramSlots.value = list
    await paramSlotsTarget.set(list)
  }

  async function removeParamSlot(id: string) {
    stopParamHold(id)
    const list = paramSlots.value.filter(s => s.id !== id)
    paramSlots.value = list
    await paramSlotsTarget.set(list)
  }

  function startParamHold(slotId: string) {
    if (holdTimerBySlotId.has(slotId)) return
    const timer = window.setInterval(async () => {
      const slot = paramSlots.value.find(s => s.id === slotId)
      if (!slot) {
        stopParamHold(slotId)
        return
      }
      if (!slot.hold) {
        stopParamHold(slotId)
        return
      }
      try {
        await injectParametersAdd([{ id: slot.parameterId, value: slot.value, weight: slot.weight }])
      } catch (err) {
        stopParamHold(slotId)
        lastError.value = err instanceof Error ? err.message : String(err)
      }
    }, 120)
    holdTimerBySlotId.set(slotId, timer)
  }

  function stopParamHold(slotId: string) {
    const timer = holdTimerBySlotId.get(slotId)
    if (timer !== undefined) {
      window.clearInterval(timer)
      holdTimerBySlotId.delete(slotId)
    }
  }

  function stopAllParamHolds() {
    for (const slotId of holdTimerBySlotId.keys()) {
      stopParamHold(slotId)
    }
  }

  async function createPreset(name = '新预设') {
    const preset: VtsPreset = {
      id: `preset-${nanoid(8)}`,
      name,
      timeInSeconds: 0.2,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      size: 0,
    }
    await upsertPreset(preset)
    return preset
  }

  async function createMacro(name = '新宏') {
    const macro: VtsMacro = {
      id: `macro-${nanoid(8)}`,
      name,
      steps: [],
    }
    await upsertMacro(macro)
    return macro
  }

  async function createParamSlot(name = 'NewParam') {
    const slot: VtsParamSlot = {
      id: `slot-${nanoid(8)}`,
      name,
      parameterId: name,
      min: 0,
      max: 1,
      step: 0.01,
      weight: 1,
      value: 0,
      hold: false,
    }
    await upsertParamSlot(slot)
    return slot
  }

  async function setPanicConfig(next: VtsPanicConfig) {
    panicConfig.value = next
    await panicTarget.set(next)
  }

  async function setObsLinkConfig(next: VtsObsLinkConfig) {
    obsLinkConfig.value = next
    await obsLinkTarget.set(next)
  }

  async function panicCalibrate() {
    if (!panicConfig.value.calibrateHotkeyId) throw new Error('未配置“校准”热键')
    await withHistory('panicCalibrate', panicConfig.value.calibrateHotkeyId, async () => triggerHotkey(panicConfig.value.calibrateHotkeyId), { hotkeyID: panicConfig.value.calibrateHotkeyId })
  }

  async function panicResetPhysics() {
    if (!panicConfig.value.resetPhysicsHotkeyId) throw new Error('未配置“重置物理”热键')
    await withHistory('panicResetPhysics', panicConfig.value.resetPhysicsHotkeyId, async () => triggerHotkey(panicConfig.value.resetPhysicsHotkeyId), { hotkeyID: panicConfig.value.resetPhysicsHotkeyId })
  }

  async function setHotkeyCustomization(next: VtsHotkeyCustomization) {
    const list = hotkeyCustomizations.value.slice()
    const idx = list.findIndex(h => h.hotkeyID === next.hotkeyID)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    hotkeyCustomizations.value = list
    await hotkeyCustomTarget.set(list)
  }

  async function removeHotkeyCustomization(hotkeyID: string) {
    const list = hotkeyCustomizations.value.filter(h => h.hotkeyID !== hotkeyID)
    hotkeyCustomizations.value = list
    await hotkeyCustomTarget.set(list)
  }

  async function refreshItems(options?: { includeFiles?: boolean }) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    const started = performance.now()
    const data = await withHistory('itemList', undefined, async () => c.itemList({
      includeAvailableSpots: false,
      includeItemInstancesInScene: true,
      includeAvailableItemFiles: options?.includeFiles ?? true,
    }))
    lastRttMs.value = Math.round(performance.now() - started)

    canLoadItems.value = data.canLoadItemsRightNow
    itemInstancesInScene.value = (data as any as VtsItemListResponseData).itemInstancesInScene ?? []
    availableItemFiles.value = (data as any as VtsItemListResponseData).availableItemFiles ?? []
  }

  async function loadItem(fileName: string, options?: { x?: number, y?: number, size?: number, rotation?: number, fadeTime?: number, order?: number }) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    const started = performance.now()
    const data = await withHistory('itemLoad', fileName, async () => c.itemLoad({
      fileName,
      positionX: options?.x,
      positionY: options?.y,
      size: options?.size,
      rotation: options?.rotation,
      fadeTime: options?.fadeTime ?? 0.2,
      order: options?.order,
      failIfOrderTaken: false,
      unloadWhenPluginDisconnects: true,
    }), { fileName, ...options })
    lastRttMs.value = Math.round(performance.now() - started)
    if (!(data as any)?.instanceID) throw new Error('ItemLoadResponse 缺少 instanceID')
    return data as any as VtsItemLoadResponseData
  }

  async function unloadItems(payload: { instanceIDs?: string[], fileNames?: string[] }) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    const instanceIDs = payload.instanceIDs ?? []
    const fileNames = payload.fileNames ?? []
    if (instanceIDs.length === 0 && fileNames.length === 0) {
      throw new Error('ItemUnload 失败：未指定 instanceIDs 或 fileNames')
    }
    const started = performance.now()
    await withHistory('itemUnload', fileNames.join(',') || instanceIDs.join(',') || undefined, async () => c.itemUnload({
      unloadAllInScene: false,
      unloadAllLoadedByThisPlugin: false,
      allowUnloadingItemsLoadedByUserOrOtherPlugins: true,
      instanceIDs,
      fileNames,
    }), { instanceIDs, fileNames })
    lastRttMs.value = Math.round(performance.now() - started)
  }

  async function setItemOpacity(itemInstanceID: string, opacity: number) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    const started = performance.now()
    await withHistory('itemOpacity', `${itemInstanceID}:${opacity}`, async () => c.itemAnimationControl({
      itemInstanceID,
      opacity,
    }), { itemInstanceID, opacity })
    lastRttMs.value = Math.round(performance.now() - started)
  }

  async function dropItem(fileName: string, options?: { x?: number, size?: number }) {
    if (!client.value) throw new Error('未连接到 VTS')
    const c = client.value
    if (!authenticated.value) throw new Error('未完成鉴权')
    const x = options?.x ?? 0
    const size = options?.size ?? 0.32
    await withHistory('dropItem', fileName, async () => {
      const loaded = await loadItem(fileName, { x, y: 1.1, size, fadeTime: 0.1 })
      try {
        await c.itemMove({
          itemsToMove: [{
            itemInstanceID: loaded.instanceID,
            timeInSeconds: 0.6,
            fadeMode: 'easeIn',
            positionX: x,
            positionY: -0.2,
          }],
        })
        const event = await waitForItemEvent(loaded.instanceID, ['DroppedPinned', 'DroppedUnpinned'], 1600)
        const delay = event ? 300 : 1200
        window.setTimeout(() => {
          void unloadItems({ instanceIDs: [loaded.instanceID] })
        }, delay)
      } catch (err) {
        await unloadItems({ instanceIDs: [loaded.instanceID] })
        throw err
      }
    }, { fileName, x, size })
  }

  async function upsertAccessory(next: VtsAccessoryBinding) {
    const list = accessories.value.slice()
    const idx = list.findIndex(a => a.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    accessories.value = list
    await accessoriesTarget.set(list)
  }

  async function removeAccessory(id: string) {
    const list = accessories.value.filter(a => a.id !== id)
    accessories.value = list
    await accessoriesTarget.set(list)
  }

  async function toggleAccessory(id: string, visible: boolean) {
    const acc = accessories.value.find(a => a.id === id)
    if (!acc) throw new Error('配饰不存在')
    if (!acc.itemInstanceID) throw new Error('配饰未绑定实例')
    await setItemOpacity(acc.itemInstanceID, visible ? 1 : 0)
    await upsertAccessory({ ...acc, visible })
  }

  async function createAccessory() {
    const acc: VtsAccessoryBinding = { id: `acc-${nanoid(8)}`, name: '新配饰', itemInstanceID: '', visible: true }
    await upsertAccessory(acc)
    return acc
  }

  async function upsertPrank(next: VtsPrankBinding) {
    const list = pranks.value.slice()
    const idx = list.findIndex(a => a.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    pranks.value = list
    await pranksTarget.set(list)
  }

  async function removePrank(id: string) {
    const list = pranks.value.filter(a => a.id !== id)
    pranks.value = list
    await pranksTarget.set(list)
  }

  async function createPrank() {
    const prank: VtsPrankBinding = { id: `prank-${nanoid(8)}`, name: '新整活', fileName: '' }
    await upsertPrank(prank)
    return prank
  }

  return {
    wsUrl,
    authToken,
    connecting,
    connected,
    authenticated,
    apiVersion,
    apiActive,
    lastRttMs,
    statistics,
    monitorLastError,
    faceFound,
    leftHandFound,
    rightHandFound,
    subscribedEvents,
    currentModelTransform,
    lastItemEvent,
    currentModelLoaded,
    currentModelName,
    currentModelId,
    hotkeys,
    presets,
    macros,
    paramSlots,
    panicConfig,
    obsLinkConfig,
    profiles,
    currentProfileId,
    hotkeyCustomizations,
    accessories,
    pranks,
    canLoadItems,
    itemInstancesInScene,
    availableItemFiles,
    history,
    lastError,
    canOperate,

    init,
    setWsUrl,
    clearAuthToken,
    connect,
    disconnect,
    requestAuthenticationToken,
    authenticate,
    refreshApiState,
    refreshHotkeys,
    refreshStatistics,
    refreshFaceFound,
    triggerHotkey,

    exportMinimalConfig,
    importMinimalConfig,
    exportFullConfig,
    importFullConfig,

    moveModel,
    upsertPreset,
    removePreset,
    applyPreset,
    createPreset,

    upsertMacro,
    removeMacro,
    runMacro,
    createMacro,

    injectParametersAdd,
    upsertParamSlot,
    removeParamSlot,
    startParamHold,
    stopParamHold,
    stopAllParamHolds,
    createParamSlot,

    setPanicConfig,
    setObsLinkConfig,
    panicCalibrate,
    panicResetPhysics,

    setHotkeyCustomization,
    removeHotkeyCustomization,

    refreshItems,
    loadItem,
    unloadItems,
    setItemOpacity,
    dropItem,

    createAccessory,
    upsertAccessory,
    removeAccessory,
    toggleAccessory,

    createPrank,
    upsertPrank,
    removePrank,

    replayHistoryRecord,
    clearHistory,

    createProfile,
    updateProfile,
    deleteProfile,
    applyProfile,
    captureCurrentToProfile,
    exportProfile,
    importProfile,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVtsStore, import.meta.hot))
