<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { VTSURU_API_URL } from '@/shared/config'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spin } from '@/shared/ui/spin'

interface BiliUserInfo {
  mid: number
  name: string
  face: string
}

interface BiliApiResponse {
  code: number
  data?: {
    card?: BiliUserInfo
  }
}

const props = defineProps<{
  placeholder?: string
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}>()

const emit = defineEmits<{
  userInfoLoaded: [userInfo: BiliUserInfo | null]
}>()

const model = defineModel<number | undefined>('value')

const inputValue = ref('')
const currentUserInfo = ref<BiliUserInfo | null>(null)
const loading = ref(false)
const showPopover = ref(false)

watch(
  model,
  (uid, _, onCleanup) => {
    inputValue.value = uid === undefined ? '' : String(uid)
    currentUserInfo.value = null
    loading.value = false
    emit('userInfoLoaded', null)
    if (uid === undefined) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => loadUserInfo(uid, controller.signal), 500)
    onCleanup(() => {
      window.clearTimeout(timer)
      controller.abort()
    })
  },
  { immediate: true },
)

async function loadUserInfo(uid: number, signal: AbortSignal) {
  loading.value = true
  try {
    const response = await fetch(`${VTSURU_API_URL}bili-user-info/${uid}`, { signal })
    const data: BiliApiResponse = await response.json()
    if (signal.aborted) return
    if (data.code !== 0 || !data.data?.card) return

    const userInfo = data.data.card
    currentUserInfo.value = userInfo
    showPopover.value = true
    emit('userInfoLoaded', userInfo)
  } catch (error) {
    if (!signal.aborted) console.error('加载用户信息失败:', error)
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  inputValue.value = target.value
  const uid = Number(inputValue.value)
  model.value = /^\d+$/.test(inputValue.value) && Number.isSafeInteger(uid) && uid > 0 ? uid : undefined
}
</script>

<template>
  <Popover v-model:open="showPopover">
    <PopoverTrigger as-child>
      <div class="relative w-full">
        <Input
          :value="inputValue"
          :placeholder="placeholder || '请输入B站用户UID'"
          :disabled="disabled"
          class="pr-7 font-mono"
          @input="handleInput"
          @focus="currentUserInfo && (showPopover = true)"
        />
        <div
          v-if="loading"
          class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <Spin size="small" />
        </div>
      </div>
    </PopoverTrigger>

    <PopoverContent
      v-if="currentUserInfo"
      class="w-64 p-2.5 text-xs"
      align="start"
    >
      <div class="flex items-center gap-2.5">
        <img
          :src="currentUserInfo.face"
          referrerpolicy="no-referrer"
          class="size-8 rounded-full object-cover border border-border/80 shrink-0"
          alt=""
        />
        <div class="min-w-0 flex flex-col gap-0.5">
          <strong class="font-medium text-foreground text-xs truncate">
            {{ currentUserInfo.name }}
          </strong>
          <span class="text-muted-foreground text-[11px] font-mono"> UID: {{ currentUserInfo.mid }} </span>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
