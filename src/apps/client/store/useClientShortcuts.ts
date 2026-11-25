import type { ShortcutEvent } from '@tauri-apps/plugin-global-shortcut'
import { nanoid } from 'nanoid'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { checkClientFeature } from '@/shared/config/clientVersion'
import { createOwnedShortcuts } from '@/shared/helpers/ownedShortcuts'

import { useDanmakuWindow } from './useDanmakuWindow'
import { useGiftWindow } from './useGiftWindow'
import { useOBSStore } from './useOBSStore'
import { useTauriStore } from './useTauriStore'
import { useVtsStore } from './useVtsStore'

export type ClientShortcutActionType =
  | 'obs_switch_scene'
  | 'obs_scene_switch'
  | 'obs_toggle_mute'
  | 'obs_save_replay'
  | 'obs_toggle_stream'
  | 'vts_preset'
  | 'vts_hotkey'
  | 'vts_macro'
  | 'vts_reset_physics'
  | 'vts_calibrate'
  | 'danmaku_window_toggle'
  | 'gift_window_toggle'
  | 'tts_skip_current'
  | 'tts_toggle_pause'
  | 'song_request_finish_and_next'
  | 'song_request_start_next'
  | 'queue_finish_and_next_batch'
  | 'queue_next_batch'

export interface ClientShortcutItem {
  id: string
  label: string
  shortcut: string
  actionType: ClientShortcutActionType
  /** 场景名 / 音频源名 / VTS 预设或热键或宏 ID */
  targetId?: string
  enabled: boolean
}

export const CLIENT_SHORTCUT_ACTION_META: Record<
  ClientShortcutActionType,
  { label: string; group: 'OBS' | 'VTS' | '浮窗' | 'TTS' | '点歌' | '排队'; needsTarget?: string }
> = {
  obs_switch_scene: { label: 'OBS：切换本地场景', group: 'OBS', needsTarget: 'OBS 场景名' },
  obs_scene_switch: { label: 'VTsuru 场景：切换子场景', group: 'OBS', needsTarget: 'VTsuru 子场景' },
  obs_toggle_mute: { label: 'OBS：静音/取消静音音频源', group: 'OBS', needsTarget: 'OBS 音频源名' },
  obs_save_replay: { label: 'OBS：保存高光回放缓存', group: 'OBS' },
  obs_toggle_stream: { label: 'OBS：开始/停止推流', group: 'OBS' },
  vts_preset: { label: 'VTS：应用机位预设', group: 'VTS', needsTarget: 'VTS 机位预设' },
  vts_hotkey: { label: 'VTS：触发热键', group: 'VTS', needsTarget: 'VTS 热键' },
  vts_macro: { label: 'VTS：运行组合宏', group: 'VTS', needsTarget: 'VTS 宏' },
  vts_reset_physics: { label: 'VTS：重置物理', group: 'VTS' },
  vts_calibrate: { label: 'VTS：校准追踪', group: 'VTS' },
  danmaku_window_toggle: { label: '浮窗：开关弹幕浮窗', group: '浮窗' },
  gift_window_toggle: { label: '浮窗：开关礼物排行浮窗', group: '浮窗' },
  tts_skip_current: { label: '读弹幕：跳过当前播报', group: 'TTS' },
  tts_toggle_pause: { label: '读弹幕：暂停/恢复播报', group: 'TTS' },
  song_request_finish_and_next: { label: '点歌：完成当前并切下一首', group: '点歌' },
  song_request_start_next: { label: '点歌：开始演唱队首曲目', group: '点歌' },
  queue_finish_and_next_batch: { label: '排队：结束本局并拉下一队', group: '排队' },
  queue_next_batch: { label: '排队：拉下一队上车', group: '排队' },
}

const STORAGE_KEY = 'client.globalShortcuts'

export const useClientShortcuts = defineStore('clientShortcuts', () => {
  const tauriStore = useTauriStore()
  const items = ref<ClientShortcutItem[]>([])
  const registerError = ref<string | null>(null)
  const initialized = ref(false)
  let ownedShortcuts: ReturnType<typeof createOwnedShortcuts> | undefined

  const featureCheck = computed(() => checkClientFeature('global-shortcut'))

  /** 汇总跨模块（工具热键 + VTS 操作台）重复绑定的快捷键 */
  const shortcutConflicts = computed(() => {
    const map = new Map<string, string[]>()
    const add = (shortcut: string | undefined, owner: string) => {
      const normalized = shortcut?.trim().toLowerCase()
      if (!normalized) return
      const list = map.get(normalized) ?? []
      list.push(owner)
      map.set(normalized, list)
    }

    for (const item of items.value) {
      if (item.enabled && item.shortcut) {
        add(item.shortcut, `热键中心「${item.label || CLIENT_SHORTCUT_ACTION_META[item.actionType].label}」`)
      }
    }

    const vtsStore = useVtsStore()
    for (const tile of vtsStore.deckTiles) {
      if (tile.shortcut) {
        add(tile.shortcut, `VTS 操作台「${tile.label || tile.type}」`)
      }
    }

    const conflicts: Array<{ shortcut: string; owners: string[] }> = []
    for (const [shortcut, owners] of map.entries()) {
      if (owners.length > 1) conflicts.push({ shortcut, owners })
    }
    return conflicts
  })

  async function executeItem(item: ClientShortcutItem) {
    const obs = useOBSStore()
    const vts = useVtsStore()
    const danmakuWindow = useDanmakuWindow()
    const giftWindow = useGiftWindow()

    switch (item.actionType) {
      case 'obs_switch_scene': {
        if (!item.targetId) throw new Error('未配置目标 OBS 场景')
        await obs.switchToScene(item.targetId)
        toast.success(`OBS 已切至场景：${item.targetId}`)
        return
      }
      case 'obs_scene_switch': {
        const [projectIdStr, sceneId] = (item.targetId ?? '').split(':')
        const projectId = Number(projectIdStr)
        if (!projectId || !sceneId) throw new Error('未配置 VTsuru 场景项目与子场景')
        const { useObsSceneControl } = await import('./useObsSceneControl')
        await useObsSceneControl().switchSubScene(projectId, sceneId)
        return
      }
      case 'obs_toggle_mute': {
        if (!item.targetId) throw new Error('未配置目标 OBS 音频源')
        const muted = await obs.toggleInputMute(item.targetId)
        toast.info(`${item.targetId} 已${muted ? '静音' : '取消静音'}`)
        return
      }
      case 'obs_save_replay': {
        const res = await obs.saveReplayBuffer()
        if (res.ok) toast.success(res.message)
        else toast.warning(res.message)
        return
      }
      case 'obs_toggle_stream': {
        await obs.handleObsToggleStream()
        return
      }
      case 'vts_preset': {
        if (!item.targetId) throw new Error('未配置 VTS 机位预设')
        await vts.applyPreset(item.targetId)
        return
      }
      case 'vts_hotkey': {
        if (!item.targetId) throw new Error('未配置 VTS 热键')
        await vts.triggerHotkey(item.targetId)
        return
      }
      case 'vts_macro': {
        if (!item.targetId) throw new Error('未配置 VTS 宏')
        await vts.runMacro(item.targetId)
        return
      }
      case 'vts_reset_physics': {
        await vts.panicResetPhysics()
        toast.success('已触发 VTS 重置物理')
        return
      }
      case 'vts_calibrate': {
        await vts.panicCalibrate()
        toast.success('已触发 VTS 校准')
        return
      }
      case 'danmaku_window_toggle': {
        if (danmakuWindow.isDanmakuWindowOpen) danmakuWindow.closeWindow()
        else danmakuWindow.openWindow()
        return
      }
      case 'gift_window_toggle': {
        if (giftWindow.isGiftWindowOpen) giftWindow.closeWindow()
        else giftWindow.openWindow()
        return
      }
      case 'tts_skip_current': {
        const { useSpeechService } = await import('@/store/useSpeechService')
        useSpeechService().skipCurrent()
        toast.info('已跳过当前弹幕朗读')
        return
      }
      case 'tts_toggle_pause': {
        const { useSpeechService } = await import('@/store/useSpeechService')
        const speech = useSpeechService()
        speech.togglePause()
        toast.info(speech.isPaused.value ? '已暂停读弹幕' : '已恢复读弹幕')
        return
      }
      case 'song_request_finish_and_next': {
        const { useLiveRequest } = await import('@/composables/useLiveRequest')
        const liveRequest = useLiveRequest()
        await liveRequest.updateActive()
        await liveRequest.finishAndStartNext()
        return
      }
      case 'song_request_start_next': {
        const { SongRequestStatus } = await import('@/api/generated/model')
        const { useLiveRequest } = await import('@/composables/useLiveRequest')
        const liveRequest = useLiveRequest()
        await liveRequest.updateActive()
        const firstWaiting = liveRequest.unfilteredActiveSongs.find((s) => s.status === SongRequestStatus.Waiting)
        if (!firstWaiting) {
          toast.info('当前待唱队列为空')
          return
        }
        await liveRequest.updateSongStatus(firstWaiting, SongRequestStatus.Singing)
        return
      }
      case 'queue_finish_and_next_batch': {
        const { useQueue } = await import('@/composables/useQueue')
        const queue = useQueue()
        await queue.updateActive()
        await queue.finishAndNextBatch()
        return
      }
      case 'queue_next_batch': {
        const { useQueue } = await import('@/composables/useQueue')
        const queue = useQueue()
        await queue.updateActive()
        await queue.nextBatch()
        return
      }
    }
  }

  async function syncRegistration() {
    if (!featureCheck.value.supported) return
    const adapter = await import('@tauri-apps/plugin-global-shortcut')
    ownedShortcuts ??= createOwnedShortcuts(adapter)
    try {
      const failed = await ownedShortcuts.replaceBestEffort(
        items.value
          .filter((i) => i.enabled && Boolean(i.shortcut.trim()))
          .map((item) => ({
            shortcut: item.shortcut.trim(),
            handler: (event: ShortcutEvent) => {
              if (event.state !== 'Pressed') return
              void executeItem(item).catch((err) => {
                toast.error(`热键执行失败: ${err instanceof Error ? err.message : String(err)}`)
              })
            },
          })),
      )
      registerError.value = failed.length > 0 ? `以下快捷键注册失败（可能已被其他程序占用）：${failed.join('、')}` : null
    } catch (err) {
      registerError.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function save() {
    await tauriStore.set(STORAGE_KEY, items.value)
    await syncRegistration()
  }

  async function addItem(actionType: ClientShortcutActionType = 'obs_save_replay') {
    const meta = CLIENT_SHORTCUT_ACTION_META[actionType]
    const next: ClientShortcutItem = {
      id: `sc-${nanoid(8)}`,
      label: meta.label,
      shortcut: '',
      actionType,
      targetId: '',
      enabled: true,
    }
    items.value = [next, ...items.value]
    await save()
    return next
  }

  async function upsertItem(item: ClientShortcutItem) {
    const idx = items.value.findIndex((i) => i.id === item.id)
    if (idx >= 0) {
      items.value = items.value.map((x) => (x.id === item.id ? { ...item } : x))
    } else {
      items.value = [{ ...item }, ...items.value]
    }
    await save()
  }

  async function removeItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
    await save()
  }

  async function init() {
    if (initialized.value) return
    initialized.value = true
    const saved = await tauriStore.get<ClientShortcutItem[]>(STORAGE_KEY)
    if (Array.isArray(saved)) {
      items.value = saved
    }
    if (featureCheck.value.supported) {
      watch(items, () => void syncRegistration(), { deep: true, immediate: true })
    }
  }

  async function dispose() {
    await ownedShortcuts?.dispose().catch(() => {})
  }

  return {
    items,
    registerError,
    featureCheck,
    shortcutConflicts,
    init,
    dispose,
    save,
    addItem,
    upsertItem,
    removeItem,
    executeItem,
    syncRegistration,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useClientShortcuts, import.meta.hot))
