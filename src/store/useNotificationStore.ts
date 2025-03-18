import { QueryGetAPI } from '@/api/query'
import { NOTIFACTION_API_URL } from '@/data/constants'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRoute } from 'vue-router'

export type NotificationData = {
  title: string
}

export const useNotificationStore = defineStore('notification', () => {
  const route = useRoute()
  const unread = ref<NotificationData[]>([])
  const all = ref<NotificationData[]>([])

  const isInited = ref(false)

  async function updateUnread() {
    try {
      const result = await QueryGetAPI<NotificationData[]>(
        NOTIFACTION_API_URL + 'get-unread'
      )
      if (result.code == 200) {
        unread.value = result.data
      }
    } catch {}
  }
  function init() {
    if (isInited.value) {
      return
    }
    setInterval(() => {
      if (route?.name?.toString().startsWith('obs-')) {
        return
      }
      updateUnread()
    }, 10 * 1000)
    isInited.value = true
  }
  return {
    init,
    unread
  }
})
