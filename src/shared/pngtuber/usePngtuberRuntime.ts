import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useAccount } from '@/api/account'
import { getRealtimeBus, useRealtimeTopic } from '@/shared/realtime'

import { DEFAULT_PNGTUBER_RUNTIME } from './types'
import type { PngtuberRuntime } from './types'

export function usePngtuberRuntime(
  userId: MaybeRefOrGetter<number>,
  channel: MaybeRefOrGetter<string>,
  controller = false,
) {
  const account = useAccount()
  const runtime = ref<PngtuberRuntime>({ ...DEFAULT_PNGTUBER_RUNTIME })
  const error = ref('')

  const topic = computed(() => {
    const id = toValue(userId)
    const room = toValue(channel) || 'default'
    if (!id || (controller && account.value.id !== id)) return ''
    return `pngtuber:channel:${id}:${room}`
  })

  const { on: onRealtimeEvent, publish: publishToTopic, status } = useRealtimeTopic(topic)

  const connected = computed(() => Boolean(topic.value && status.value.connected))

  function silence() {
    runtime.value = {
      ...runtime.value,
      isSpeaking: false,
      volume: 0,
      source: '',
      updatedAt: Date.now(),
    }
  }

  onRealtimeEvent<Partial<PngtuberRuntime>>('state', (value) => {
    if (!value) return
    const nextUpdatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()
    if (nextUpdatedAt < runtime.value.updatedAt) return
    runtime.value = {
      ...runtime.value,
      ...(value.expressionId !== undefined ? { expressionId: value.expressionId ?? '' } : {}),
      ...(value.isSpeaking !== undefined ? { isSpeaking: Boolean(value.isSpeaking) } : {}),
      ...(value.volume !== undefined ? { volume: Number(value.volume) || 0 } : {}),
      ...(value.muted !== undefined ? { muted: Boolean(value.muted) } : {}),
      ...(value.away !== undefined ? { away: Boolean(value.away) } : {}),
      ...(value.source !== undefined ? { source: value.source ?? '' } : {}),
      updatedAt: nextUpdatedAt,
    }
  })

  watch(
    () => status.value.connected,
    (isConnected) => {
      if (!isConnected) {
        silence()
      } else {
        error.value = ''
      }
    },
  )

  watch(
    () => status.value.error,
    (err) => {
      if (err) error.value = err
    },
  )

  let lastSendTime = 0
  let lastSentSpeaking: boolean | null = null
  let isPublishing = false

  async function publish(volume: number, speaking: boolean, source: 'controller' | 'client' | 'obs') {
    if (!connected.value || !topic.value) return
    const now = performance.now()
    const isEdge = lastSentSpeaking !== speaking || (volume === 0 && !speaking && lastSentSpeaking === true)
    if (!isEdge && (isPublishing || now - lastSendTime < 50)) return
    isPublishing = true
    lastSendTime = now
    lastSentSpeaking = speaking
    try {
      await publishToTopic('audio', { volume, isSpeaking: speaking, source })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      isPublishing = false
    }
  }

  async function control(patch: Partial<Pick<PngtuberRuntime, 'expressionId' | 'muted' | 'away'>>, durationMs = 0) {
    if (!connected.value || !controller || !topic.value) throw new Error('立绘控制连接尚未就绪')
    await publishToTopic('control', {
      expressionId: patch.expressionId ?? null,
      muted: patch.muted ?? null,
      away: patch.away ?? null,
      durationMs,
    })
  }

  async function stopPublishing() {
    lastSentSpeaking = false
    if (connected.value && controller && topic.value) {
      await publishToTopic('audio', { volume: 0, isSpeaking: false, source: 'client' })
    }
  }

  async function reconnect() {
    silence()
    error.value = ''
    if (!topic.value) return
    try {
      const bus = getRealtimeBus()
      await bus.ensureConnected()
      await bus.unsubscribe(topic.value)
      await bus.subscribe(topic.value)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  onScopeDispose(() => {
    silence()
  })

  return { runtime, connected, error, publish, control, stopPublishing, reconnect }
}
