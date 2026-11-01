import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useAccount } from '@/api/account'
import { useRealtimeTopic } from '@/shared/realtime'
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
      source: null,
      updatedAt: Date.now(),
    }
  }

  onRealtimeEvent<PngtuberRuntime>('State', (value) => {
    if (!value) return
    if (value.updatedAt >= runtime.value.updatedAt) {
      runtime.value = value
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
  let isPublishing = false

  async function publish(volume: number, speaking: boolean, source: 'controller' | 'client' | 'obs') {
    if (!connected.value || !topic.value || isPublishing || performance.now() - lastSendTime < 50) return
    isPublishing = true
    lastSendTime = performance.now()
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
    if (connected.value && controller && topic.value) {
      await publishToTopic('audio', { volume: 0, isSpeaking: false, source: 'client' })
    }
  }

  function reconnect() {
    silence()
  }

  onScopeDispose(() => {
    silence()
  })

  return { runtime, connected, error, publish, control, stopPublishing, reconnect }
}
