import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBiliFunction } from './useBiliFunction'

export interface BatchPmRecipient {
  id: string
  uid: number
  uname: string
  extra?: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  error?: string
  sentAt?: number
}

export const useBatchPrivateMessageQueue = defineStore('batchPrivateMessageQueue', () => {
  const biliFunc = useBiliFunction()

  const recipients = ref<BatchPmRecipient[]>([])
  const template = ref('你好 {uname}，感谢支持！{extra}')
  const intervalMs = ref(4000) // 默认 4 秒安全间隔，避免触发私信风控
  const running = ref(false)
  const paused = ref(false)

  const stats = computed(() => {
    const total = recipients.value.length
    const sent = recipients.value.filter((r) => r.status === 'sent').length
    const failed = recipients.value.filter((r) => r.status === 'failed').length
    const pending = recipients.value.filter((r) => r.status === 'pending' || r.status === 'sending').length
    return { total, sent, failed, pending }
  })

  function addRecipients(list: Array<{ uid: number; uname?: string; extra?: string }>) {
    const existing = new Set(recipients.value.map((r) => r.uid))
    let added = 0
    for (const item of list) {
      if (!item.uid || item.uid <= 0 || existing.has(item.uid)) continue
      existing.add(item.uid)
      recipients.value.push({
        id: `${item.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        uid: item.uid,
        uname: item.uname?.trim() || `UID ${item.uid}`,
        extra: item.extra?.trim() || '',
        status: 'pending',
      })
      added++
    }
    return added
  }

  function removeRecipient(id: string) {
    recipients.value = recipients.value.filter((r) => r.id !== id)
  }

  function clearAll() {
    if (running.value) return
    recipients.value = []
  }

  function retryFailed() {
    for (const r of recipients.value) {
      if (r.status === 'failed') {
        r.status = 'pending'
        r.error = undefined
      }
    }
  }

  function renderMessage(r: BatchPmRecipient): string {
    return template.value
      .replace(/\{uname\}/g, r.uname)
      .replace(/\{uid\}/g, String(r.uid))
      .replace(/\{extra\}/g, r.extra || '')
      .trim()
  }

  async function start() {
    if (running.value) {
      paused.value = false
      return
    }
    if (!template.value.trim()) {
      throw new Error('请先填写私信内容模板')
    }
    running.value = true
    paused.value = false

    try {
      await biliFunc.init()
      for (const item of recipients.value) {
        if (!running.value) break
        while (paused.value && running.value) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
        if (!running.value) break
        if (item.status !== 'pending') continue

        const msg = renderMessage(item)
        if (!msg) {
          item.status = 'failed'
          item.error = '渲染后消息为空'
          continue
        }

        item.status = 'sending'
        try {
          const ok = await biliFunc.sendPrivateMessage(item.uid, msg)
          if (ok) {
            item.status = 'sent'
            item.sentAt = Date.now()
            item.error = undefined
          } else {
            item.status = 'failed'
            item.error = '接口返回失败（可能被风控或对方关闭陌生人私信）'
          }
        } catch (err) {
          item.status = 'failed'
          item.error = err instanceof Error ? err.message : String(err)
        }

        const safeDelay = Math.max(3000, Number(intervalMs.value) || 4000)
        await new Promise((resolve) => setTimeout(resolve, safeDelay))
      }
    } finally {
      running.value = false
      paused.value = false
    }
  }

  function pause() {
    paused.value = true
  }

  function stop() {
    running.value = false
    paused.value = false
  }

  return {
    recipients,
    template,
    intervalMs,
    running,
    paused,
    stats,
    addRecipients,
    removeRecipient,
    clearAll,
    retryFailed,
    renderMessage,
    start,
    pause,
    stop,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBatchPrivateMessageQueue, import.meta.hot))
}
