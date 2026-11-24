import EasySpeech from 'easy-speech'
import { nextTick, reactive, ref, watch } from 'vue'
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'worker-timers'

import { DownloadConfig, isLoggedIn, UploadConfig, useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'
import { createVoiceProvider, hasVoiceProvider } from '@/apps/open-live/voice-providers'
import { usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'
import { useMessage } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import {
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
  makeDefaultTemplate,
  normalizeSettings,
  templateConstants,
} from './speech/settings'
import {
  getEventKey,
  insertSpaces,
  isJoinFansClubGift,
  renderSpeechTemplate,
  selectTemplate,
} from './speech/templateEngine'
import type { QueueItem, SpeechEventKey, SpeechSettings, SpeechState } from './speech/types'

export * from './speech/types'
export { DEFAULT_TEMPLATES, makeDefaultTemplate, templateConstants }

const PAID_EVENT_TYPES = new Set([EventDataTypes.Gift, EventDataTypes.SC, EventDataTypes.Guard])
const CONTENT_EVENT_TYPES = new Set([EventDataTypes.Message, EventDataTypes.SC])
const SPEECH_EVENT_NAMES = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'follow'] as const

let speechServiceInstance: ReturnType<typeof createSpeechService> | null = null

function createSpeechService() {
  const message = useMessage()
  const accountInfo = useAccount()
  const danmakuClient = useDanmakuClient()
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  const settings = usePersistedStorage<SpeechSettings>('Setting.Speech', DEFAULT_SETTINGS)
  watch(
    settings,
    (value) => {
      const normalized = normalizeSettings(value)
      if (normalized !== value) settings.value = normalized
    },
    { immediate: true, flush: 'sync' },
  )

  // 云端自动同步
  let _cloudSyncSuppressed = false
  let _initComplete = false
  let _cloudSaveTimer: ReturnType<typeof globalThis.setTimeout> | undefined

  async function syncFromCloud() {
    if (!isLoggedIn.value) return
    try {
      const result = await DownloadConfig<SpeechSettings>('Speech')
      if (result.status === 'success' && result.data) {
        _cloudSyncSuppressed = true
        settings.value = normalizeSettings(result.data)
        await nextTick()
        _cloudSyncSuppressed = false
      }
    } catch (e) {
      console.warn('[TTS] 云端配置同步失败:', e)
    }
  }

  function debouncedSaveToCloud() {
    if (_cloudSyncSuppressed || !isLoggedIn.value || !_initComplete) return
    if (_cloudSaveTimer) globalThis.clearTimeout(_cloudSaveTimer)
    _cloudSaveTimer = globalThis.setTimeout(() => {
      UploadConfig('Speech', settings.value)
    }, 3000)
  }

  watch(settings, debouncedSaveToCloud, { deep: true })

  const speechState = reactive<SpeechState>({
    isSpeaking: false,
    speakingText: '',
    isApiAudioLoading: false,
    apiAudioSrc: '',
    canSpeech: false,
    isInitialized: false,
  })

  const speakQueue = ref<QueueItem[]>([])
  const pendingGifts = new Map<string, QueueItem>()
  const readedDanmaku = ref(0)
  const spokenHistory = ref<Array<{ text: string; uname: string; type: string; time: number }>>([])
  const rejectedHistory = ref<Array<{ uname: string; type: string; reason: string; time: number }>>([])
  const isPaused = ref(false)
  const lastSpeakTimeByUser = new Map<string, number>()
  const recentMessages = new Set<string>()
  const joinedFansClubUsers = new Set<string>()

  const apiAudio = ref<HTMLAudioElement>()
  let notificationAudioCtx: AudioContext | null = null
  let checkTimer: number | undefined
  let loadingTimeoutTimer: number | undefined
  let speechQueueTimer: number | undefined
  let timedBroadcastTimer: number | undefined
  let timedBroadcastIndex = 0
  let pendingObjectUrl: string | undefined
  let speechRunId = 0
  let isProcessingQueue = false
  let danmakuListenersAttached = false

  function revokePendingObjectUrl() {
    if (pendingObjectUrl) {
      URL.revokeObjectURL(pendingObjectUrl)
      pendingObjectUrl = undefined
    }
  }

  // 播放器必须由 store 持有：页面卸载后 SpeechMiniController 仍要继续播
  function ensureAudioElement(): HTMLAudioElement {
    if (apiAudio.value) return apiAudio.value
    const el = new Audio()
    el.addEventListener('canplay', () => {
      speechState.isApiAudioLoading = false
      clearLoadingTimeout()
    })
    el.addEventListener('ended', () => {
      cancelSpeech()
    })
    el.addEventListener('error', () => {
      clearLoadingTimeout()
      if (!speechState.apiAudioSrc) return
      message.error('音频加载失败')
      cancelSpeech()
    })
    el.addEventListener('loadedmetadata', () => {
      void setAudioOutputDevice()
    })
    apiAudio.value = el
    return el
  }

  async function setAudioOutputDevice() {
    const el = apiAudio.value
    const deviceId = settings.value.outputDeviceId
    if (!el || !deviceId) return
    try {
      if (typeof el.setSinkId === 'function') await el.setSinkId(deviceId)
    } catch (err) {
      console.warn('[TTS] 设置音频输出设备失败:', deviceId, err)
    }
  }

  function playApiAudio(url: string, runId: number) {
    const el = ensureAudioElement()
    el.volume = Math.min(1, Math.max(0, settings.value.speechInfo.volume ?? 1))
    void setAudioOutputDevice()
    speechState.apiAudioSrc = url
    el.src = url
    el.play()
      .then(() => {
        if (runId !== speechRunId) return
        speechState.isApiAudioLoading = false
        clearLoadingTimeout()
      })
      .catch((error) => {
        if (runId !== speechRunId) return
        console.error('[TTS] 音频播放失败:', error)
        message.error(`音频播放失败: ${error instanceof Error ? error.message : '未知错误'}`)
        cancelSpeech()
      })
  }

  watch(
    () => settings.value.speechInfo.volume,
    (volume) => {
      if (apiAudio.value) apiAudio.value.volume = Math.min(1, Math.max(0, volume ?? 1))
    },
  )

  const speechSynthesisInfo = ref<{
    speechSynthesis: SpeechSynthesis | undefined
    speechSynthesisUtterance: SpeechSynthesisUtterance | undefined
    speechSynthesisVoice: SpeechSynthesisVoice | undefined
    onvoiceschanged: boolean
  }>()

  let _cachedProvider: { id: string; instance: ReturnType<typeof createVoiceProvider> } | undefined

  function getCurrentProvider() {
    const id = settings.value.provider
    if (!hasVoiceProvider(id)) return undefined
    if (_cachedProvider?.id === id) return _cachedProvider.instance
    const instance = createVoiceProvider(id, () => settings.value)
    _cachedProvider = { id, instance }
    return instance
  }

  async function initialize() {
    if (speechState.isInitialized) return

    await syncFromCloud()

    try {
      await EasySpeech.init({ maxTimeout: 5000, interval: 250 })
      speechSynthesisInfo.value = EasySpeech.detect()

      const voices = EasySpeech.voices()
      if (voices.length > 0 && !settings.value.speechInfo.voice) {
        const chineseVoice = voices.find((v) => v.lang.startsWith('zh'))
        settings.value.speechInfo.voice = chineseVoice?.name || voices[0].name
      }

      const provider = getCurrentProvider()
      if (provider) await provider.initialize()
      ensureAudioElement()
      attachDanmakuListeners()

      speechQueueTimer = setInterval(() => {
        void processQueue()
      }, 250)

      speechState.isInitialized = true
      _initComplete = true
      console.log('[TTS] 语音服务初始化完成')
    } catch (error) {
      console.error('[TTS] 初始化失败:', error)
      message.error('语音服务初始化失败')
    }
  }

  watch(
    () => [
      settings.value.timedBroadcast.enabled,
      settings.value.timedBroadcast.intervalMinutes,
      settings.value.timedBroadcast.texts.filter((t) => t.trim()).join('\n'),
      speechState.canSpeech,
    ],
    () => {
      startTimedBroadcast()
    },
  )

  function resolveEventKey(data: EventModel, recordJoin = true): SpeechEventKey | null {
    if (settings.value.enabledEvents.joinFansClub && isJoinFansClubGift(data, danmakuClient.sourceType === 'openlive')) {
      const userKey = String(data.uid || data.ouid || data.uname || '')
      if (!recordJoin || !userKey || !joinedFansClubUsers.has(userKey)) {
        if (recordJoin && userKey) joinedFansClubUsers.add(userKey)
        return 'joinFansClub'
      }
    }
    return getEventKey(data.type)
  }

  function destroy() {
    if (speechQueueTimer) {
      clearInterval(speechQueueTimer)
      speechQueueTimer = undefined
    }
    if (checkTimer) {
      clearTimeout(checkTimer)
      checkTimer = undefined
    }
    if (loadingTimeoutTimer) {
      clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }
    if (_cloudSaveTimer) {
      globalThis.clearTimeout(_cloudSaveTimer)
      _cloudSaveTimer = undefined
    }
    detachDanmakuListeners()
    if (notificationAudioCtx && notificationAudioCtx.state !== 'closed') {
      void notificationAudioCtx.close().catch(() => {})
      notificationAudioCtx = null
    }
    stopTimedBroadcast()
    cancelSpeech()
    isProcessingQueue = false
    pendingGifts.clear()
    joinedFansClubUsers.clear()
    speakQueue.value = []
    speechState.isInitialized = false
    console.log('[TTS] 语音服务已销毁')
  }

  function getTextFromDanmaku(
    data: EventModel | undefined,
    eventKeyOverride?: SpeechEventKey | null,
  ): string | undefined {
    if (!data) return
    const eventKey = eventKeyOverride ?? resolveEventKey(data, false)
    if (!eventKey) return
    const template = selectTemplate(settings.value.templates[eventKey], data)
    if (!template) return
    return renderSpeechTemplate(template, data, settings.value)
  }

  function buildApiUrl(text: string): string | null {
    const provider = getCurrentProvider()
    if (!provider || !provider.buildAudioUrl) {
      message.error('当前语音提供商不支持音频 URL 构建')
      return null
    }

    const url = provider.buildAudioUrl(text)
    if (!url) return null

    // vtsuru 测试 API 特殊检查
    try {
      const tempURL = new URL(url)
      if (tempURL.hostname.toLowerCase().includes('voice.vtsuru.live')) {
        tempURL.searchParams.set('vtsuruId', accountInfo.value?.id.toString() ?? '-1')
        if ([...segmenter.segment(tempURL.searchParams.get('text') ?? '')].length > 100) {
          message.error('本站提供的测试接口字数不允许超过 100 字')
          return null
        }
        return tempURL.toString()
      }
    } catch {
      // 允许用户填写相对路径或非标准模板 URL
    }

    return url
  }

  function doSpeak(text: string) {
    const provider = getCurrentProvider()
    if (!provider) {
      cancelSpeech()
      return
    }

    const runId = ++speechRunId
    speechState.isSpeaking = true
    speechState.speakingText = text

    if (checkTimer) clearTimeout(checkTimer)
    checkTimer = setTimeout(() => {
      if (runId !== speechRunId) return
      message.error('语音播放超时')
      cancelSpeech()
    }, 30000)

    if (provider.isAudioProvider) {
      speechState.isApiAudioLoading = true
      speechState.apiAudioSrc = ''

      if (loadingTimeoutTimer) clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = setTimeout(() => {
        if (runId === speechRunId && speechState.isApiAudioLoading) {
          console.error('[TTS] 音频加载超时 (25秒)')
          message.error('音频加载超时，请检查网络连接或API状态')
          cancelSpeech()
        }
      }, 25000)

      if (provider.fetchAudio) {
        provider
          .fetchAudio(text)
          .then((blob) => {
            if (runId !== speechRunId) return
            const url = URL.createObjectURL(blob)
            revokePendingObjectUrl()
            pendingObjectUrl = url
            playApiAudio(url, runId)
          })
          .catch((error) => {
            if (runId !== speechRunId) return
            console.error('[TTS] 获取音频失败:', error)
            message.error(`语音合成失败: ${error instanceof Error ? error.message : '未知错误'}`)
            cancelSpeech()
          })
      } else if (provider.buildAudioUrl) {
        const url = provider.buildAudioUrl(text)
        if (!url) {
          cancelSpeech()
          return
        }
        playApiAudio(url, runId)
      } else {
        message.error('当前语音提供商未实现音频获取')
        cancelSpeech()
      }
    } else {
      Promise.resolve(provider.speak(text))
        .then(() => {
          if (runId === speechRunId) cancelSpeech()
        })
        .catch((error) => {
          if (runId !== speechRunId) return
          console.error('[TTS] 播放错误:', error)
          message.error(`无法播放语音: ${error instanceof Error ? error.message : '未知错误'}`)
          cancelSpeech()
        })
    }

    console.log(`[TTS] 正在朗读: ${text}`)
  }

  async function processQueue() {
    if (isProcessingQueue || speechState.isSpeaking || speakQueue.value.length === 0) return
    if (isPaused.value) return

    isProcessingQueue = true
    try {
      const now = Date.now()
      const combineDelay = (settings.value.combineGiftDelay ?? 0) * 1000

      let targetIndex = -1
      for (let i = 0; i < speakQueue.value.length; i++) {
        const item = speakQueue.value[i]
        const itemEventKey = item.eventKey ?? getEventKey(item.data.type)
        if (itemEventKey === 'gift' && combineDelay > 0 && item.updateAt > now - combineDelay) {
          continue
        }
        targetIndex = i
        break
      }

      if (targetIndex === -1) return

      const targetItem = speakQueue.value.splice(targetIndex, 1)[0]
      const eventKey = targetItem.eventKey ?? getEventKey(targetItem.data.type)

      if (eventKey === 'gift') {
        const giftKey = `${targetItem.data.uid}-${targetItem.data.msg}`
        if (pendingGifts.get(giftKey) === targetItem) pendingGifts.delete(giftKey)
      }

      let text = getTextFromDanmaku(targetItem.data, eventKey)
      if (!text) return
      readedDanmaku.value++

      spokenHistory.value.unshift({
        text,
        uname: targetItem.data.uname,
        type: String(targetItem.data.type),
        time: Date.now(),
      })
      if (spokenHistory.value.length > 50) spokenHistory.value.length = 50

      if (
        settings.value.notificationSound.enabled &&
        eventKey &&
        settings.value.notificationSound.events.includes(eventKey)
      ) {
        await playNotificationSound()
      }

      if (settings.value.provider === 'api' && settings.value.providers.api?.splitText) {
        text = insertSpaces(text)
      }

      doSpeak(text)
    } finally {
      isProcessingQueue = false
    }
  }

  function getNotificationAudioContext(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null
    if (!notificationAudioCtx || notificationAudioCtx.state === 'closed') {
      notificationAudioCtx = new AudioContext()
    }
    return notificationAudioCtx
  }

  async function playNotificationSound(): Promise<void> {
    const ctx = getNotificationAudioContext()
    if (!ctx) return

    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        globalThis.clearTimeout(fallbackTimer)
        resolve()
      }
      // 浏览器策略挂起 AudioContext 时兜底放行，防止阻塞后续队列
      const fallbackTimer = globalThis.setTimeout(finish, 800)

      void (async () => {
        try {
          if (ctx.state === 'suspended') {
            await Promise.race([
              ctx.resume(),
              new Promise<void>((r) => globalThis.setTimeout(r, 250)),
            ])
          }
          if (ctx.state !== 'running') {
            finish()
            return
          }
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = 880
          osc.type = 'sine'
          const volume = Math.min(1, Math.max(0.001, settings.value.notificationSound.volume ?? 0.3))
          gain.gain.setValueAtTime(volume, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          osc.onended = finish
          osc.start()
          osc.stop(ctx.currentTime + 0.3)
        } catch (err) {
          console.warn('[TTS] 播放提示音失败:', err)
          finish()
        }
      })()
    })
  }

  function cancelSpeech() {
    speechRunId++
    speechState.isSpeaking = false

    if (checkTimer) {
      clearTimeout(checkTimer)
      checkTimer = undefined
    }
    if (loadingTimeoutTimer) {
      clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }

    speechState.isApiAudioLoading = false
    speechState.apiAudioSrc = ''

    const el = apiAudio.value
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    revokePendingObjectUrl()

    getCurrentProvider()?.stop()
    speechState.speakingText = ''
  }

  function clearLoadingTimeout() {
    if (loadingTimeoutTimer) {
      clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }
  }

  function reject(data: EventModel, reason: string) {
    rejectedHistory.value.unshift({ uname: data.uname, type: String(data.type), reason, time: Date.now() })
    if (rejectedHistory.value.length > 50) rejectedHistory.value.length = 50
  }

  function addToQueue(data: EventModel) {
    if (!speechState.canSpeech) return
    enqueueEvent(data)
  }

  function enqueueEvent(data: EventModel, eventKeyOverride?: SpeechEventKey | null) {
    const eventKey = eventKeyOverride ?? resolveEventKey(data, true)
    if (eventKey && !settings.value.enabledEvents[eventKey]) {
      reject(data, '事件类型已关闭')
      return
    }

    if (data.type === EventDataTypes.Message && (data.emoji || /^(?:\[\w+\])+$/.test(data.msg))) {
      reject(data, '纯表情弹幕')
      return
    }

    if (settings.value.blacklistUsers.length > 0) {
      const lowerName = data.uname.toLowerCase()
      if (settings.value.blacklistUsers.some((u) => lowerName === u.toLowerCase())) {
        reject(data, '用户黑名单')
        return
      }
    }

    if (CONTENT_EVENT_TYPES.has(data.type) && settings.value.blacklistKeywords.length > 0 && data.msg) {
      const lowerMsg = data.msg.toLowerCase()
      if (settings.value.blacklistKeywords.some((kw) => lowerMsg.includes(kw.toLowerCase()))) {
        reject(data, '关键词黑名单')
        return
      }
    }

    if (!PAID_EVENT_TYPES.has(data.type) && settings.value.antiSpamInterval > 0) {
      const userKey = String(data.uid)
      const lastTime = lastSpeakTimeByUser.get(userKey)
      const now = Date.now()
      if (lastTime && now - lastTime < settings.value.antiSpamInterval * 1000) {
        reject(data, '防刷屏间隔')
        return
      }
      lastSpeakTimeByUser.set(userKey, now)
    }

    if (!PAID_EVENT_TYPES.has(data.type) && settings.value.deduplicateIdentical) {
      // enter 等事件 msg 为空且 uid 恒为 0, 用 ouid/uname 作为稳定身份标识; 平台会对入场事件重复推送, 必须去重
      const identity = data.uid || data.ouid || data.uname
      const dedupKey = `${data.type}:${identity}:${data.msg}`
      if (recentMessages.has(dedupKey)) {
        reject(data, '重复内容')
        return
      }
      recentMessages.add(dedupKey)
      setTimeout(() => recentMessages.delete(dedupKey), 10000)
    }

    if (eventKey) {
      const template = selectTemplate(settings.value.templates[eventKey], data)
      if (!template) {
        reject(data, '无匹配模板规则')
        return
      }
    }

    const maxSize = settings.value.maxQueueSize || 50
    if (speakQueue.value.length >= maxSize) {
      if (settings.value.queueFullStrategy === 'reject-new') {
        reject(data, '队列已满')
        return
      }
      speakQueue.value.splice(0, speakQueue.value.length - maxSize + 1)
    }

    let giftKey: string | undefined
    if (data.type === EventDataTypes.Gift && eventKey === 'gift' && settings.value.combineGiftDelay) {
      giftKey = `${data.uid}-${data.msg}`
      const pending = pendingGifts.get(giftKey)
      if (
        pending &&
        speakQueue.value.includes(pending) &&
        pending.updateAt > Date.now() - settings.value.combineGiftDelay * 1000
      ) {
        pending.updateAt = Date.now()
        pending.data.num += data.num
        pending.data.price += data.price
        pending.combineCount = (pending.combineCount ?? 0) + data.num
        return
      }
    }

    const item: QueueItem = {
      data,
      eventKey: eventKey ?? undefined,
      updateAt: eventKey === 'gift' ? Date.now() : 0,
    }
    if (giftKey) pendingGifts.set(giftKey, item)

    const isPriority = settings.value.priorityEvents.includes(eventKey ?? '')
    if (isPriority) {
      speakQueue.value.unshift(item)
    } else {
      speakQueue.value.push(item)
    }
  }

  function testEvent(
    data: EventModel,
    eventKeyOverride?: SpeechEventKey,
  ): { success: boolean; text?: string; reason?: string } {
    const eventKey = eventKeyOverride ?? resolveEventKey(data, false)
    const text = getTextFromDanmaku(data, eventKey)
    if (!text) {
      const config = eventKey ? settings.value.templates[eventKey] : undefined
      if (!config || config.rules.length === 0) {
        return { success: false, reason: '未配置任何模板规则' }
      }
      return { success: false, reason: '测试事件不满足模板中的条件规则' }
    }
    enqueueEvent(data, eventKey)
    return { success: true, text }
  }

  function attachDanmakuListeners() {
    if (danmakuListenersAttached) return
    danmakuListenersAttached = true
    for (const eventName of SPEECH_EVENT_NAMES) {
      danmakuClient.onEvent(eventName, addToQueue)
    }
  }

  function detachDanmakuListeners() {
    if (!danmakuListenersAttached) return
    danmakuListenersAttached = false
    for (const eventName of SPEECH_EVENT_NAMES) {
      danmakuClient.offEvent(eventName, addToQueue)
    }
  }

  attachDanmakuListeners()

  function forceSpeak(data: EventModel, eventKeyOverride?: SpeechEventKey) {
    cancelSpeech()
    const index = speakQueue.value.findIndex((v) => v.data === data)
    const existing = index !== -1 ? speakQueue.value.splice(index, 1)[0] : undefined
    speakQueue.value.unshift({
      updateAt: 0,
      eventKey: existing?.eventKey ?? eventKeyOverride ?? resolveEventKey(data, false) ?? undefined,
      data,
    })
  }

  /**
   * 直接朗读一段自定义文本（供 AutoAction SPEAK_TTS 等独立调用）
   */
  async function speakText(rawText: string): Promise<void> {
    const text = rawText.trim()
    if (!text) return
    await whenPersistedReady(settings)
    if (!speechState.isInitialized) {
      try {
        await EasySpeech.init({ maxTimeout: 3000, interval: 200 })
      } catch {
        // 非浏览器原生 provider 时可忽略
      }
      ensureAudioElement()
      const provider = getCurrentProvider()
      await provider?.initialize?.()
    }
    const finalText =
      settings.value.provider === 'api' && settings.value.providers.api?.splitText ? insertSpaces(text) : text
    cancelSpeech()
    doSpeak(finalText)
  }

  function removeFromQueue(item: QueueItem) {
    const index = speakQueue.value.indexOf(item)
    if (index !== -1) {
      speakQueue.value.splice(index, 1)
      if (item.data.type === EventDataTypes.Gift) {
        const giftKey = `${item.data.uid}-${item.data.msg}`
        if (pendingGifts.get(giftKey) === item) pendingGifts.delete(giftKey)
      }
    }
  }

  function moveQueueItem(from: number, to: number) {
    if (from === to) return
    const len = speakQueue.value.length
    if (from < 0 || from >= len || to < 0 || to >= len) return
    const [moved] = speakQueue.value.splice(from, 1)
    speakQueue.value.splice(to, 0, moved)
  }

  function pinToTop(item: QueueItem) {
    const index = speakQueue.value.indexOf(item)
    if (index <= 0) return
    speakQueue.value.splice(index, 1)
    speakQueue.value.unshift(item)
  }

  function startSpeech() {
    speechState.canSpeech = true
    message.success('服务已启动')
  }

  function startTimedBroadcast() {
    stopTimedBroadcast()
    if (!speechState.canSpeech) return
    const { enabled, intervalMinutes, texts } = settings.value.timedBroadcast
    const validTexts = texts.filter((t) => t.trim())
    if (!enabled || validTexts.length === 0 || intervalMinutes <= 0) return
    timedBroadcastTimer = setInterval(
      () => {
        if (!speechState.canSpeech || isPaused.value) return
        if (isProcessingQueue || speechState.isSpeaking || speechState.isApiAudioLoading) return
        const text = validTexts[timedBroadcastIndex % validTexts.length]
        timedBroadcastIndex++
        doSpeak(text.trim())
      },
      intervalMinutes * 60 * 1000,
    )
  }

  function stopTimedBroadcast() {
    if (timedBroadcastTimer) {
      clearInterval(timedBroadcastTimer)
      timedBroadcastTimer = undefined
    }
  }

  function stopSpeech() {
    speechState.canSpeech = false
    speakQueue.value = []
    pendingGifts.clear()
    cancelSpeech()
    stopTimedBroadcast()
    message.success('已停止监听')
  }

  async function downloadConfig() {
    try {
      const result = await DownloadConfig<SpeechSettings>('Speech')
      if (result.status === 'success' && result.data) {
        _cloudSyncSuppressed = true
        settings.value = normalizeSettings(result.data)
        await nextTick()
        _cloudSyncSuppressed = false
        message.success('已获取配置文件')
      } else if (result.status === 'notfound') {
        message.error('未上传配置文件')
      } else {
        message.error(`获取失败: ${result.msg}`)
      }
    } catch (error) {
      console.error('[TTS] 下载配置失败:', error)
      message.error(`获取失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  function getAvailableVoices() {
    const provider = getCurrentProvider()
    if (!provider) return []
    const voices = provider.getVoices()
    return voices instanceof Promise ? [] : voices
  }

  async function previewVoice(text = '你好，这是一段试听'): Promise<void> {
    const provider = getCurrentProvider()
    if (!provider) {
      message.error('未选择语音提供商')
      return
    }

    if (!provider.isAudioProvider) {
      try {
        await provider.speak(text)
      } catch (error) {
        message.error(`试听失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
      return
    }

    let audioUrl: string | null = null
    let createdObjectUrl = false
    try {
      if (provider.fetchAudio) {
        const blob = await provider.fetchAudio(text)
        audioUrl = URL.createObjectURL(blob)
        createdObjectUrl = true
      } else if (provider.buildAudioUrl) {
        audioUrl = provider.buildAudioUrl(text)
      }
      if (!audioUrl) throw new Error('无法构造音频地址')

      const audio = new Audio(audioUrl)
      audio.volume = settings.value.speechInfo.volume ?? 1
      const cleanup = () => {
        if (createdObjectUrl) URL.revokeObjectURL(audioUrl)
      }
      audio.addEventListener('ended', cleanup, { once: true })
      audio.addEventListener('error', cleanup, { once: true })
      await audio.play()
    } catch (error) {
      if (createdObjectUrl && audioUrl) URL.revokeObjectURL(audioUrl)
      console.error('[TTS] 试听失败:', error)
      message.error(`试听失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return {
    settings,
    speechState,
    speakQueue,
    readedDanmaku,
    spokenHistory,
    rejectedHistory,
    isPaused,
    speechSynthesisInfo,
    apiAudio,
    initialize,
    destroy,
    addToQueue,
    testEvent,
    forceSpeak,
    speakText,
    removeFromQueue,
    moveQueueItem,
    pinToTop,
    clearQueue: () => {
      speakQueue.value = []
      pendingGifts.clear()
    },
    startSpeech,
    stopSpeech,
    cancelSpeech,
    clearLoadingTimeout,
    downloadConfig,
    getTextFromDanmaku,
    getAvailableVoices,
    previewVoice,
    buildApiUrl,
    getCurrentProvider,
    setAudioOutputDevice,
    togglePause: () => {
      isPaused.value = !isPaused.value
    },
    skipCurrent: () => {
      cancelSpeech()
    },
  }
}

export function useSpeechService() {
  if (!speechServiceInstance) {
    speechServiceInstance = createSpeechService()
  }
  return speechServiceInstance
}
