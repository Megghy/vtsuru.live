import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import type { LevelTypes, PaginationResponse } from '@/api/api-models'
import {
  getApiNotificationGet,
  getApiNotificationGetUnread,
  postApiNotificationRead,
} from '@/api/generated/notifaction/notifaction'

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
  const unread = ref<NotificationItem[]>([])
  const latest = ref<NotificationItem[]>([])

  const unreadCount = computed(() => unread.value.length)

  const isInited = ref(false)

  async function refreshUnread() {
    try {
      const result = (await getApiNotificationGetUnread()) as unknown as {
        code: number
        data?: any[]
      }
      if (result.code === 200) {
        unread.value = (result.data ?? []).map(normalizeNotification)
      }
    } catch (err) {
      console.warn('[notification] refreshUnread failed', err)
    }
  }

  async function refreshLatest(pn: number = 0, ps: number = 20, onlyUnread: boolean = false) {
    const result = (await getApiNotificationGet({
      pn,
      ps,
      unread: onlyUnread ? true : undefined,
    })) as unknown as PaginationResponse<any[]>

    if (result.code === 200) {
      latest.value = (result.data ?? []).map(normalizeNotification)
      return result as PaginationResponse<NotificationItem[]>
    }
    throw new Error(result.message)
  }

  async function markRead(ids: string[]) {
    if (!ids.length) return

    const result = (await postApiNotificationRead({ id: ids as any })) as unknown as {
      code: number
      message?: string
    }
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

    void updateUnread()
    setInterval(() => {
      if (route?.name?.toString().startsWith('obs-')) {
        return
      }
      void updateUnread()
    }, 10 * 1000)
    isInited.value = true
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
