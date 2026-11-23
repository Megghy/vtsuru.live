import { nanoid } from 'nanoid'

import { useTauriStore } from '@/apps/client/store/useTauriStore'

import { persistedList, persistedValue } from './persisted'
import type {
  VtsAccessoryBinding,
  VtsDeckTile,
  VtsExportV2,
  VtsHotkeyCustomization,
  VtsMacro,
  VtsMinimalExportV1,
  VtsObsLinkConfig,
  VtsPanicConfig,
  VtsParamSlot,
  VtsPrankBinding,
  VtsPreset,
  VtsProfile,
  VtsProfileData,
  VtsProfileExportV1,
} from './schemas'
import { fullExportSchema, minimalExportSchema, parseImport, profileExportSchema } from './schemas'

export const DEFAULT_WS_URL = 'ws://127.0.0.1:8001'

const DEFAULT_PRESETS: VtsPreset[] = [
  { id: 'preset-talk', name: '杂谈模式', timeInSeconds: 0.2, positionX: 0, positionY: 0, rotation: 0, size: 0 },
  { id: 'preset-game', name: '游戏模式', timeInSeconds: 0.2, positionX: 0.7, positionY: -0.6, rotation: 0, size: -20 },
  { id: 'preset-closeup', name: '特写模式', timeInSeconds: 0.2, positionX: 0, positionY: 0, rotation: 0, size: 30 },
]

const DEFAULT_PARAM_SLOTS: VtsParamSlot[] = (
  [
    ['Blush', 0],
    ['Pale', 0],
    ['Body_Y', -1],
    ['EyeOpen', 0],
    ['MouthOpen', 0],
  ] as const
).map(([name, min]) => ({
  id: `slot-${name.toLowerCase().replace('_', '')}`,
  name,
  parameterId: name,
  min,
  max: 1,
  step: 0.01,
  weight: 1,
  value: 0,
  defaultValue: 0,
  mode: 'add',
  hold: false,
}))

const DEFAULT_PANIC: VtsPanicConfig = { calibrateHotkeyId: '', resetPhysicsHotkeyId: '' }
const DEFAULT_OBS_LINK: VtsObsLinkConfig = { enabled: false, debounceMs: 150, sceneToPresetId: {} }

export function createVtsConfig() {
  const tauriStore = useTauriStore()
  const target = <T>(key: string, fallback: T) => tauriStore.getTarget<T>(`vts.${key}`, fallback)
  const byId = (x: { id: string }) => x.id

  const wsUrl = persistedValue(target('wsUrl', DEFAULT_WS_URL), DEFAULT_WS_URL)
  const authToken = persistedValue(target('authToken', ''), '')
  const presets = persistedList<VtsPreset>(target('presets', DEFAULT_PRESETS), byId)
  const macros = persistedList<VtsMacro>(target('macros', []), byId)
  const paramSlots = persistedList<VtsParamSlot>(target('paramSlots', DEFAULT_PARAM_SLOTS), byId)
  const panic = persistedValue(target('panic', DEFAULT_PANIC), DEFAULT_PANIC)
  const obsLink = persistedValue(target('obsLink', DEFAULT_OBS_LINK), DEFAULT_OBS_LINK)
  const hotkeyCustom = persistedList<VtsHotkeyCustomization>(target('hotkeyCustom', []), (h) => h.hotkeyID)
  const accessories = persistedList<VtsAccessoryBinding>(target('accessories', []), byId)
  const pranks = persistedList<VtsPrankBinding>(target('pranks', []), byId)
  const deck = persistedList<VtsDeckTile>(target('deck', []), byId)
  const profiles = persistedList<VtsProfile>(target('profiles', []), byId)
  const currentProfileId = persistedValue(target('currentProfileId', ''), '')

  const all = [
    wsUrl,
    authToken,
    presets,
    macros,
    paramSlots,
    panic,
    obsLink,
    hotkeyCustom,
    accessories,
    pranks,
    deck,
    profiles,
    currentProfileId,
  ]

  async function loadConfig() {
    await Promise.all(all.map(async (p) => p.load()))
  }

  function snapshotProfileData(): VtsProfileData {
    return {
      hotkeyCustomizations: hotkeyCustom.value.value,
      presets: presets.value.value,
      macros: macros.value.value,
      paramSlots: paramSlots.value.value,
      panic: panic.value.value,
      obsLink: obsLink.value.value,
      accessories: accessories.value.value,
      pranks: pranks.value.value,
      deck: deck.value.value,
    }
  }

  async function saveProfileData(data: VtsProfileData) {
    const tasks: Promise<void>[] = [
      hotkeyCustom.save(data.hotkeyCustomizations),
      presets.save(data.presets),
      macros.save(data.macros),
      paramSlots.save(data.paramSlots),
      panic.save(data.panic),
      obsLink.save(data.obsLink),
      accessories.save(data.accessories),
      pranks.save(data.pranks),
    ]
    if (data.deck !== undefined) {
      tasks.push(deck.save(data.deck))
    }
    await Promise.all(tasks)
  }

  function findProfile(id: string) {
    const profile = profiles.value.value.find((p) => p.id === id)
    if (!profile) throw new Error('Profile 不存在')
    return profile
  }

  async function addProfile(
    name: string,
    data: VtsProfileData,
    meta?: Pick<VtsProfile, 'modelId' | 'modelName' | 'autoApplyOnModelLoad'>,
  ) {
    let uniqueName = name.trim() || '新配置方案'
    if (profiles.value.value.some((p) => p.name === uniqueName)) {
      let suffix = 2
      while (profiles.value.value.some((p) => p.name === `${uniqueName} (${suffix})`)) suffix++
      uniqueName = `${uniqueName} (${suffix})`
    }
    const profile: VtsProfile = {
      id: `profile-${nanoid(8)}`,
      name: uniqueName,
      modelId: meta?.modelId,
      modelName: meta?.modelName,
      autoApplyOnModelLoad: meta?.autoApplyOnModelLoad,
      data,
    }
    await profiles.save([profile, ...profiles.value.value])
    return profile
  }

  async function create<T extends { id: string }>(list: { upsert: (item: T) => Promise<void> }, item: T) {
    await list.upsert(item)
    return item
  }

  return {
    wsUrl: wsUrl.value,
    authToken: authToken.value,
    presets: presets.value,
    macros: macros.value,
    paramSlots: paramSlots.value,
    panicConfig: panic.value,
    obsLinkConfig: obsLink.value,
    hotkeyCustomizations: hotkeyCustom.value,
    accessories: accessories.value,
    pranks: pranks.value,
    deckTiles: deck.value,
    profiles: profiles.value,
    currentProfileId: currentProfileId.value,

    loadConfig,
    saveAuthToken: authToken.save,
    saveDeck: deck.save,
    upsertDeckTile: deck.upsert,
    removeDeckTile: deck.remove,

    setWsUrl: async (next: string) => wsUrl.save(next.trim()),
    upsertPreset: presets.upsert,
    removePreset: presets.remove,
    createPreset: async (name = '新预设') =>
      create(presets, {
        id: `preset-${nanoid(8)}`,
        name,
        timeInSeconds: 0.2,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        size: 0,
      }),
    newPresetDraft: (name = '新预设'): VtsPreset => ({
      id: `preset-${nanoid(8)}`,
      name,
      timeInSeconds: 0.2,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      size: 0,
    }),
    upsertMacro: macros.upsert,
    removeMacro: macros.remove,
    createMacro: async (name = '新宏') => create(macros, { id: `macro-${nanoid(8)}`, name, steps: [] }),
    newMacroDraft: (name = '新宏'): VtsMacro => ({ id: `macro-${nanoid(8)}`, name, steps: [] }),
    upsertParamSlot: paramSlots.upsert,
    removeParamSlotConfig: paramSlots.remove,
    createParamSlot: async (name = 'NewParam', opts?: Partial<VtsParamSlot>) =>
      create(paramSlots, {
        id: `slot-${nanoid(8)}`,
        name,
        parameterId: opts?.parameterId ?? name,
        min: opts?.min ?? 0,
        max: opts?.max ?? 1,
        step: opts?.step ?? 0.01,
        weight: opts?.weight ?? 1,
        value: opts?.defaultValue ?? opts?.value ?? 0,
        defaultValue: opts?.defaultValue ?? 0,
        mode: opts?.mode ?? 'add',
        hold: false,
      }),
    setPanicConfig: panic.save,
    setObsLinkConfig: obsLink.save,
    setHotkeyCustomization: hotkeyCustom.upsert,
    removeHotkeyCustomization: hotkeyCustom.remove,
    upsertAccessory: accessories.upsert,
    removeAccessory: accessories.remove,
    createAccessory: async () =>
      create(accessories, { id: `acc-${nanoid(8)}`, name: '新配饰', itemInstanceID: '', visible: true }),
    upsertPrank: pranks.upsert,
    removePrank: pranks.remove,
    createPrank: async () =>
      create(pranks, { id: `prank-${nanoid(8)}`, name: '新整活', fileName: '', dropX: 0, dropSize: 0.32 }),

    exportMinimalConfig: (includeToken = false): VtsMinimalExportV1 => ({
      version: 1,
      wsUrl: wsUrl.value.value,
      ...(includeToken ? { authToken: authToken.value.value } : {}),
    }),
    async importMinimalConfig(payload: unknown) {
      const p = parseImport(minimalExportSchema, payload)
      const tasks: Promise<void>[] = [wsUrl.save(p.wsUrl)]
      if (p.authToken) tasks.push(authToken.save(p.authToken))
      await Promise.all(tasks)
    },
    exportFullConfig: (includeToken = false): VtsExportV2 => ({
      version: 2,
      wsUrl: wsUrl.value.value,
      ...(includeToken ? { authToken: authToken.value.value } : {}),
      ...snapshotProfileData(),
      deck: deck.value.value,
    }),
    async importFullConfig(payload: unknown) {
      const p = parseImport(fullExportSchema, payload)
      const tasks: Promise<void>[] = [
        wsUrl.save(p.wsUrl),
        saveProfileData({ ...p, obsLink: p.obsLink ?? obsLink.value.value, deck: p.deck ?? deck.value.value }),
      ]
      if (p.authToken) tasks.push(authToken.save(p.authToken))
      await Promise.all(tasks)
    },

    createProfile: async (
      name = '新配置方案',
      meta?: Pick<VtsProfile, 'modelId' | 'modelName' | 'autoApplyOnModelLoad'>,
    ) => addProfile(name, snapshotProfileData(), meta),
    updateProfile: profiles.upsert,
    async deleteProfile(id: string) {
      await profiles.remove(id)
      if (currentProfileId.value.value === id) await currentProfileId.save('')
    },
    async applyProfile(id: string) {
      await saveProfileData(findProfile(id).data)
      await currentProfileId.save(id)
    },
    async captureCurrentToProfile(id: string) {
      await profiles.upsert({ ...findProfile(id), data: snapshotProfileData() })
    },
    exportProfile(id: string): VtsProfileExportV1 {
      const profile = findProfile(id)
      return {
        version: 1,
        name: profile.name,
        modelId: profile.modelId,
        modelName: profile.modelName,
        autoApplyOnModelLoad: profile.autoApplyOnModelLoad,
        data: profile.data,
      }
    },
    async importProfile(payload: unknown) {
      const p = parseImport(profileExportSchema, payload)
      return addProfile(p.name, p.data, {
        modelId: p.modelId,
        modelName: p.modelName,
        autoApplyOnModelLoad: p.autoApplyOnModelLoad,
      })
    },
  }
}

export type VtsConfig = ReturnType<typeof createVtsConfig>
