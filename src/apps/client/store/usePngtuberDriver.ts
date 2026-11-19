import { defineStore } from 'pinia'
import { computed, effectScope, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseObsSyncState } from '@/api/generated/model'
import { getObsSyncState, updateObsSyncState } from '@/api/obs-store'
import { isTauri } from '@/shared/config'
import { createOwnedShortcuts } from '@/shared/helpers/ownedShortcuts'
import { createExpressionHotkeys } from '@/shared/helpers/pngtuberHotkeys'
import { createAudioGate } from '@/shared/pngtuber/audioGate'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { DEFAULT_PNGTUBER_RUNTIME } from '@/shared/pngtuber/types'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { useAudioReactive } from '@/shared/pngtuber/useAudioReactive'
import { usePngtuberCollab } from '@/shared/pngtuber/usePngtuberCollab'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'
import { useRealtimeTopic } from '@/shared/realtime'

import { useOBSStore } from './useOBSStore'

/** One explicitly started session per Pinia, independent of route/component lifetime. */
export const usePngtuberDriver = defineStore('pngtuber-driver', () => {
  const account = useAccount()
  const obs = useOBSStore()
  const collab = usePngtuberCollab()
  const channel = ref('default')
  const audioMode = ref<'microphone' | 'obs'>('microphone')
  const deviceId = ref('default')
  const obsInput = ref('')
  const running = ref(false),
    starting = ref(false),
    error = ref('')
  const config = ref(normalizePngtuberState({}))
  const configHash = ref('')
  const live = shallowRef<ReturnType<typeof usePngtuberRuntime>>()
  const audio = shallowRef<ReturnType<typeof useAudioReactive>>()
  const connected = computed(() => live.value?.connected.value ?? false)
  const runtime = computed(() => live.value?.runtime.value ?? { ...DEFAULT_PNGTUBER_RUNTIME })
  const statusError = computed(() => error.value || audio.value?.errorMessage.value || live.value?.error.value || '')
  const volume = ref(0),
    speaking = ref(false),
    inputMuted = ref(false)
  const devices = ref<{ deviceId: string; label: string }[]>([])
  let generation = 0
  let session: ReturnType<typeof effectScope> | undefined
  let shortcuts: ReturnType<typeof createOwnedShortcuts> | undefined
  let cleanup = Promise.resolve()

  async function refreshDevices() {
    try {
      const list = await navigator.mediaDevices?.enumerateDevices()
      devices.value = (list ?? [])
        .filter((item) => item.kind === 'audioinput')
        .map((item, i) => ({ deviceId: item.deviceId, label: item.label || `麦克风 ${i + 1}` }))
    } catch (cause) {
      error.value = String(cause)
    }
  }

  async function loadConfig() {
    const owner = account.value.id
    const targetChannel = channel.value.trim() || 'default'
    if (!owner) return
    try {
      const snapshot = await getObsSyncState('pngtuber', targetChannel, undefined, owner)
      configHash.value = snapshot.hash
      config.value = normalizePngtuberState(snapshot.data ? JSON.parse(snapshot.data) : {})
    } catch {
      // Initial preload failure is surfaced explicitly when user starts driver or saves settings.
    }
  }

  async function patchConfig(patch: Partial<PngtuberState>) {
    const owner = account.value.id
    const targetChannel = channel.value.trim() || 'default'
    if (!owner) throw new Error('请先登录')
    const latest = await getObsSyncState('pngtuber', targetChannel, undefined, owner)
    const base = normalizePngtuberState(latest.data ? JSON.parse(latest.data) : {})
    const next = normalizePngtuberState({ ...base, ...patch })
    const saved = await updateObsSyncState('pngtuber', targetChannel, JSON.stringify(next), latest.hash)
    configHash.value = saved.hash
    config.value = next
    if (collab.inRoom.value) collab.broadcastConfig(next)
  }

  function stop() {
    generation++
    running.value = starting.value = false
    const oldLive = live.value,
      oldAudio = audio.value,
      oldScope = session,
      oldShortcuts = shortcuts
    const publishing = oldLive?.stopPublishing().catch((cause) => {
      error.value = String(cause)
    })
    const stoppingAudio = oldAudio?.stopListening()
    // Send StopPublishing before disposing its hub connection; stop capture immediately.
    const stoppingSession = Promise.resolve(publishing).finally(() => oldScope?.stop())
    session = undefined
    live.value = undefined
    audio.value = undefined
    shortcuts = undefined
    volume.value = 0
    speaking.value = inputMuted.value = false
    cleanup = Promise.all([cleanup, stoppingSession, stoppingAudio, oldShortcuts?.dispose()])
      .then(() => {})
      .catch((cause) => {
        error.value = String(cause)
      })
    return cleanup
  }

  async function control(patch: Parameters<ReturnType<typeof usePngtuberRuntime>['control']>[0], durationMs = 0) {
    if (!running.value || !live.value) throw new Error('请先启动 PNGtuber 驱动')
    await live.value.control(patch, durationMs)
    if (collab.inRoom.value) collab.broadcastControl(patch, durationMs)
  }

  async function switchExpression(expressionId: string, durationMs = 0, targetChannel = 'default') {
    if (targetChannel.trim() !== channel.value)
      throw new Error(`PNGtuber 驱动当前频道为 ${channel.value}，请启动目标频道 ${targetChannel}`)
    if (!config.value.expressions.some((expression) => expression.id === expressionId))
      throw new Error(`表情不存在：${expressionId}`)
    if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error('持续时间必须为非负毫秒数')
    await control({ expressionId }, durationMs)
  }

  async function start() {
    if (running.value || starting.value) return
    channel.value = channel.value.trim() || 'default'
    const stopping = stop()
    const version = generation
    starting.value = true
    error.value = ''
    await stopping
    if (version !== generation) return
    const owner = account.value.id
    const targetChannel = channel.value.trim() || 'default'
    channel.value = targetChannel
    if (!owner) {
      starting.value = false
      error.value = '请先登录'
      return
    }
    const scope = effectScope(true)
    session = scope
    const current = () => version === generation
    const validateInputMode = () => {
      const expected = audioMode.value === 'obs' ? 'obs' : 'client'
      if (config.value.inputMode !== expected)
        throw new Error(`当前音频来源需要展示页输入模式为 ${expected}，请在完整模型设置中修改后重新启动`)
    }
    try {
      const snapshot = await getObsSyncState('pngtuber', targetChannel, undefined, owner)
      if (!current()) return
      config.value = normalizePngtuberState(snapshot.data ? JSON.parse(snapshot.data) : {})
      validateInputMode()
      configHash.value = snapshot.hash

      let registerKeys: (() => Promise<void>) | null = null

      const active = scope.run(() => {
        const liveRuntime = usePngtuberRuntime(owner, targetChannel, true)
        const stateTopic = useRealtimeTopic(`obs-store:state:${owner}:pngtuber:${targetChannel}`)
        stateTopic.on<ResponseObsSyncState>('StateChanged', async (updated) => {
          if (!current() || !updated || updated.hash === configHash.value || !updated.data) return
          try {
            const next = normalizePngtuberState(JSON.parse(updated.data))
            config.value = next
            configHash.value = updated.hash
            validateInputMode()
            if (collab.inRoom.value) collab.broadcastConfig(next)
            await registerKeys?.()
          } catch (cause) {
            if (current()) {
              await stop()
              error.value = cause instanceof Error ? cause.message : String(cause)
            }
          }
        })

        const audioReactive = useAudioReactive({
          autoStart: false,
          deviceId: () => deviceId.value,
          threshold: () => config.value.threshold,
          closeThreshold: () => config.value.closeThreshold,
          attackDelay: () => config.value.attackDelay,
          releaseDelay: () => config.value.releaseDelay,
          gain: () => config.value.gain,
          noiseSuppression: () => config.value.noiseSuppression,
          muted: () => liveRuntime.runtime.value.muted || liveRuntime.runtime.value.away,
          onVolume: (vol, isActive) => publish(vol, isActive, 'client'),
        })

        function publish(vol: number, isActive: boolean, source: 'client' | 'obs') {
          if (!current()) return
          const muted =
            liveRuntime.runtime.value.muted || liveRuntime.runtime.value.away || (source === 'obs' && inputMuted.value)
          volume.value = muted ? 0 : vol
          speaking.value = !muted && isActive
          void liveRuntime.publish(volume.value, speaking.value, source).catch((cause) => {
            if (current()) error.value = String(cause)
          })
          if (collab.inRoom.value) collab.broadcastAudio(volume.value, speaking.value)
        }

        if (audioMode.value === 'obs') {
          const gate = createAudioGate()
          let lastMeter = 0
          let wasActive = false
          const unsubscribe = obs.subscribeInputVolume((sample) => {
            if (!current() || (sample.inputName && sample.inputName !== obsInput.value)) return
            lastMeter = performance.now()
            inputMuted.value = sample.muted
            if (sample.muted || liveRuntime.runtime.value.muted || liveRuntime.runtime.value.away) gate.reset()
            const value = Number.isFinite(sample.volume)
              ? Math.max(0, Math.min(100, sample.volume * config.value.gain))
              : 0
            const activeSpeech = !sample.muted && gate.sample(value, performance.now(), config.value)
            wasActive = value > 0 || activeSpeech
            publish(value, activeSpeech, 'obs')
          })
          // Removed/disconnected/inactive OBS inputs must not leave the mouth open,
          // but avoid sending redundant zero packets every 100ms while already silent.
          const watchdog = setInterval(() => {
            if ((!obs.obsConnected || performance.now() - lastMeter > 500) && (wasActive || speaking.value || volume.value > 0)) {
              gate.reset()
              wasActive = false
              publish(0, false, 'obs')
            }
          }, 100)
          onScopeDispose(() => {
            unsubscribe()
            clearInterval(watchdog)
          })
        }
        return { live: liveRuntime, audio: audioReactive }
      })!
      live.value = active.live
      audio.value = active.audio
      if (audioMode.value === 'obs') {
        if (!obs.obsConnected) throw new Error('请先在直播管理中连接 OBS')
        await obs.fetchObsInputs()
        if (!current()) return
        if (!obsInput.value || !obs.obsInputs.includes(obsInput.value)) throw new Error('请选择有效的 OBS 输入源')
      } else {
        const started = await active.audio.startListening(deviceId.value)
        if (!current()) return
        if (!started) throw new Error(active.audio.errorMessage.value || '麦克风启动失败')
        void refreshDevices()
      }
      if (isTauri()) {
        const adapter = await import('@tauri-apps/plugin-global-shortcut')
        if (!current()) return
        shortcuts = createOwnedShortcuts(adapter)
      }
      const hotkeys = createExpressionHotkeys({
        current: () => runtime.value.expressionId,
        enabled: () => current() && running.value,
        control: (expressionId, duration) => control({ expressionId }, duration),
        onError: (cause) => {
          if (current()) error.value = String(cause)
        },
      })
      registerKeys = async () => {
        await hotkeys.release()
        await shortcuts?.replace(
          config.value.expressions
            .filter((expression) => expression.hotkey.trim())
            .map((expression) => ({
              shortcut: expression.hotkey,
              handler: hotkeys.bind(expression),
            })),
        )
      }
      await registerKeys()
      if (!current()) return
      running.value = true
      starting.value = false
    } catch (cause) {
      if (current()) {
        await stop()
        error.value = cause instanceof Error ? cause.message : String(cause)
      }
    }
  }

  // No route lifecycle hooks: account/session changes are the shutdown boundary.
  watch(
    () => [account.value.id, account.value.token],
    () => {
      void stop()
    },
    { flush: 'sync' },
  )
  watch(
    [channel, audioMode, deviceId, obsInput],
    () => {
      if (running.value || starting.value) void stop()
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    void stop()
  })
  return {
    channel,
    audioMode,
    deviceId,
    obsInput,
    running,
    starting,
    connected,
    config,
    runtime,
    statusError,
    volume,
    speaking,
    inputMuted,
    devices,
    refreshDevices,
    loadConfig,
    patchConfig,
    start,
    stop,
    control,
    switchExpression,
  }
})
