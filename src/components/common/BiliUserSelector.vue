<script setup lang="ts">
import { NAutoComplete, NAvatar, NFlex, NText } from 'naive-ui'
import type { AutoCompleteOption } from 'naive-ui'
import { h, ref, watch } from 'vue'

import { VTSURU_API_URL } from '@/shared/config'

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

type BiliUserSelectorOption = AutoCompleteOption & { userInfo?: BiliUserInfo }

defineProps<{
  placeholder?: string
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}>()

const emit = defineEmits<{
  userInfoLoaded: [userInfo: BiliUserInfo | null]
}>()

// 使用 defineModel 作为外部 v-model:value 绑定
const model = defineModel<number | undefined>('value')

const inputValue = ref('')
const options = ref<BiliUserSelectorOption[]>([])
const loading = ref(false)
// 输入只负责同步 UID；查询由监听器统一防抖，并取消过期请求。
watch(
  model,
  (uid, _, onCleanup) => {
    inputValue.value = uid === undefined ? '' : String(uid)
    options.value = []
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
    options.value = [
      {
        label: String(uid),
        value: String(uid),
        userInfo,
      },
    ]
    emit('userInfoLoaded', userInfo)
  } catch (error) {
    if (!signal.aborted) console.error('加载用户信息失败:', error)
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

function handleInput(value: string | null) {
  inputValue.value = value ?? ''
  const uid = Number(inputValue.value)
  model.value = /^\d+$/.test(inputValue.value) && Number.isSafeInteger(uid) && uid > 0 ? uid : undefined
}

// 自定义渲染选项
function renderLabel(option: BiliUserSelectorOption) {
  const { userInfo } = option
  if (!userInfo) {
    return h(NText, { depth: 3 }, { default: () => '加载中...' })
  }

  return h(
    NFlex,
    { align: 'center', gap: 8 },
    {
      default: () => [
        h(NAvatar, {
          src: userInfo.face,
          size: 32,
          round: true,
          imgProps: {
            referrerpolicy: 'no-referrer',
          },
        }),
        h(
          NFlex,
          { vertical: true, gap: 2 },
          {
            default: () => [
              h(NText, { strong: true }, { default: () => userInfo.name }),
              h(NText, { depth: 3, size: 'small' }, { default: () => `UID: ${userInfo.mid}` }),
            ],
          },
        ),
      ],
    },
  )
}
</script>

<template>
  <NAutoComplete
    :value="inputValue"
    :options="options"
    :loading="loading"
    :placeholder="placeholder || '请输入B站用户UID'"
    :size="size || 'medium'"
    :disabled="disabled"
    clearable
    :render-label="renderLabel"
    @update:value="handleInput"
  />
</template>
