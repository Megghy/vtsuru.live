import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isLoggedIn, useAccount } from '@/api/account'
import type { PaginationResponse } from '@/api/client-types'
import type { LevelTypes } from '@/api/generated/model'
import {
  getApiNotificationGet,
  getApiNotificationGetUnread,
  postApiNotificationRead,
} from '@/api/generated/notifaction/notifaction'
import { getRealtimeBus, useRealtimeTopic } from '@/shared/realtime'

export interface NotificationItem {
  id: string
  createTime: number
  title: string
  message: string
  type: LevelTypes
  notifactionType: number
  sender?: number | null
  extra: Record<string, string>
  isReaded: boolean
}

function normalizeNotification(raw: any): NotificationItem {
  const extra = raw?.extra ?? raw?.Extra ?? {}
  return {
    id: raw?.id ?? raw?.Id,
    createTime: raw?.createTime ?? raw?.CreateTime,
    title: raw?.title ?? raw?.Title,
    message: raw?.message ?? raw?.Message,
    type: raw?.type ?? raw?.Type,
    notifactionType: raw?.notifactionType ?? raw?.NotifactionType,
    sender: raw?.sender ?? raw?.Sender,
    extra: extra ?? {},
    isReaded: raw?.isReaded ?? raw?.IsReaded ?? false,
  }
}

export const useNotificationStore = defineStore('notification', () => {
  const route = useRoute()
  const account = useAccount()
  const unread = ref<NotificationItem[]>([])
  const latest = ref<NotificationItem[]>([])

  const unreadCount = computed(() => unread.value.length)

  const isInited = ref(false)
  const bus = getRealtimeBus()
  const busStatus = bus.getStatus()
  const reconnectedCount = bus.getReconnectedCount()

  const userEventsTopic = computed(() => {
    if (!isInited.value || !isLoggedIn.value || account.value.id <= 0) return ''
    if (route?.name?.toString().startsWith('obs-')) return ''
    return `user:events:${account.value.id}`
  })
  const { on: onUserEvent } = useRealtimeTopic(userEventsTopic)

  async function refreshUnread() {
    try {
      const result = await getApiNotificationGetUnread()
      if (result.code === 200) {
        unread.value = (result.data ?? []).map(normalizeNotification)
      }
    } catch (err) {
      console.warn('[notification] refreshUnread failed', err)
    }
  }

  async function refreshLatest(pn: number = 0, ps: number = 20, onlyUnread: boolean = false) {
    const result = await getApiNotificationGet({
      pn,
      ps,
      unread: onlyUnread ? true : undefined,
    })

    if (result.code === 200) {
      latest.value = (result.data ?? []).map(normalizeNotification)
      return {
        ...result,
        data: latest.value,
      }
    }
    throw new Error(result.message)
  }

  async function markRead(ids: string[]) {
    if (!ids.length) return

    const result = await postApiNotificationRead({ id: ids as any })
    if (result.code !== 200) {
      throw new Error(result.message)
    }

    const idSet = new Set(ids)
    unread.value = unread.value.filter((n) => !idSet.has(n.id))
    latest.value = latest.value.map((n) => (idSet.has(n.id) ? { ...n, isReaded: true } : n))
  }

  async function updateUnread() {
    if (!isLoggedIn.value) return
    await refreshUnread()
  }

  function init() {
    if (isInited.value) {
      return
    }

    isInited.value = true
    void updateUnread()

    onUserEvent('NotificationChanged', () => {
      if (route?.name?.toString().startsWith('obs-')) return
      void updateUnread()
    })

    watch(reconnectedCount, () => {
      if (!route?.name?.toString().startsWith('obs-')) {
        void updateUnread()
      }
    })

    // 仅在实时通道未连接时做低频兜底轮询 (120s)
    setInterval(() => {
      if (busStatus.value.connected) return
      if (route?.name?.toString().startsWith('obs-')) {
        return
      }
      void updateUnread()
    }, 120 * 1000)
  }
  return {
    init,
    unread,
    latest,
    unreadCount,
    refreshUnread,
    refreshLatest,
    markRead,
  }
})
