import { onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { RealtimeEventHandler, RealtimeTopicOptions } from './types'
import { getRealtimeBus } from './useRealtimeBus'

export function useRealtimeTopic(
  topicRef: MaybeRefOrGetter<string>,
  options: RealtimeTopicOptions = {},
) {
  const bus = getRealtimeBus()
  const status = bus.getStatus()
  const activeTopic = ref<string>('')
  const unbindList: Array<() => void> = []

  let currentSubscribed = ''
  let disposed = false
  let pendingSync: Promise<void> | null = null
  let syncQueued = false

  function runSync(): Promise<void> {
    if (pendingSync) {
      syncQueued = true
      return pendingSync
    }

    const promise = (async () => {
      do {
        syncQueued = false
        const nextTopic = disposed ? '' : toValue(topicRef).trim()
        if (nextTopic === currentSubscribed) continue

        if (currentSubscribed) {
          const prevTopic = currentSubscribed
          currentSubscribed = ''
          await bus.unsubscribe(prevTopic)
        }

        if (disposed) {
          activeTopic.value = ''
          continue
        }

        if (nextTopic) {
          currentSubscribed = nextTopic
          activeTopic.value = nextTopic
          try {
            await bus.subscribe(nextTopic, options.key)
          } catch (err) {
            if (!disposed) {
              console.error(`[useRealtimeTopic] 订阅 ${nextTopic} 失败:`, err)
            }
          }
        } else {
          activeTopic.value = ''
        }
      } while (syncQueued)
    })().finally(() => {
      pendingSync = null
    })

    pendingSync = promise
    return promise
  }

  function syncSubscription() {
    return runSync()
  }

  if (options.immediate !== false) {
    watch(
      () => toValue(topicRef),
      () => {
        void syncSubscription()
      },
      { immediate: true },
    )
  }

  onScopeDispose(() => {
    disposed = true
    for (const unbind of unbindList) {
      unbind()
    }
    unbindList.length = 0
    void syncSubscription()
  })

  function on<T = any>(eventName: string, handler: RealtimeEventHandler<T>): () => void {
    const wrapped: RealtimeEventHandler = (payload) => {
      handler(payload as T)
    }
    // 动态绑定到当前主题
    let unregister = () => {}
    const register = (t: string) => {
      unregister()
      if (t) {
        unregister = bus.on(t, eventName, wrapped)
      }
    }

    if (currentSubscribed) {
      register(currentSubscribed)
    }

    const stopWatch = watch(
      activeTopic,
      (newTopic) => {
        register(newTopic)
      },
      { immediate: true },
    )

    const cleanup = () => {
      stopWatch()
      unregister()
    }
    unbindList.push(cleanup)
    return cleanup
  }

  async function publish(eventName: string, payload: unknown) {
    const t = currentSubscribed || toValue(topicRef).trim()
    if (!t) throw new Error('未设置有效的主题，无法发布事件')
    await bus.publish(t, eventName, payload)
  }

  return {
    status,
    activeTopic,
    on,
    publish,
    syncSubscription,
  }
}
