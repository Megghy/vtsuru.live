import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { LevelTypes, PaginationResponse } from '@/api/api-models'
import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryGetPaginationAPI } from '@/api/query'
import { NOTIFICATION_API_URL } from '@/shared/config'

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
    const result = await QueryGetAPI<any[]>(`${NOTIFICATION_API_URL}get-unread`)
    if (result.code === 200) {
      unread.value = (result.data ?? []).map(normalizeNotification)
      return
    }
    throw new Error(result.message)
  }

  async function refreshLatest(pn: number = 0, ps: number = 20, onlyUnread: boolean = false) {
    const result = await QueryGetPaginationAPI<any[]>(`${NOTIFICATION_API_URL}get`, {
      pn,
      ps,
      unread: onlyUnread ? true : undefined,
    })

    if (result.code === 200) {
      latest.value = (result.data ?? []).map(normalizeNotification)
      return result as PaginationResponse<NotificationItem[]>
    }
    throw new Error(result.message)
  }

  async function markRead(ids: string[]) {
    if (!ids.length) return

    const params = new URLSearchParams()
    for (const id of ids) {
      params.append('id', id)
    }
    const result = await QueryGetAPI<number>(`${NOTIFICATION_API_URL}read`, params)
    if (result.code !== 200) {
      throw new Error(result.message)
    }

    const idSet = new Set(ids)
    unread.value = unread.value.filter(n => !idSet.has(n.id))
    latest.value = latest.value.map(n => (idSet.has(n.id) ? { ...n, isReaded: true } : n))
  }

  async function updateUnread() {
    if (!isLoggedIn.value) return
    await refreshUnread()
  }

  function init() {
    if (isInited.value) {
      return
    }

    void updateUnread().catch(err => console.warn('[notification] refreshUnread failed', err))
    setInterval(() => {
      if (route?.name?.toString().startsWith('obs-')) {
        return
      }
      void updateUnread().catch(err => console.warn('[notification] refreshUnread failed', err))
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
