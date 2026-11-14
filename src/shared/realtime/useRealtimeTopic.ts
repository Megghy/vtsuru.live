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

  async function syncSubscription() {
    const nextTopic = toValue(topicRef).trim()
    if (nextTopic === currentSubscribed) return

    if (currentSubscribed) {
      await bus.unsubscribe(currentSubscribed)
      currentSubscribed = ''
    }

    if (nextTopic) {
      currentSubscribed = nextTopic
      activeTopic.value = nextTopic
      try {
        await bus.subscribe(nextTopic, options.key)
      } catch (err) {
        console.error(`[useRealtimeTopic] 订阅 ${nextTopic} 失败:`, err)
      }
    } else {
      activeTopic.value = ''
    }
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
    for (const unbind of unbindList) {
      unbind()
    }
    unbindList.length = 0
    if (currentSubscribed) {
      void bus.unsubscribe(currentSubscribed)
      currentSubscribed = ''
    }
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
