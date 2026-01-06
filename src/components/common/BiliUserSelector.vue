<script setup lang="ts">
import { NAutoComplete, NAvatar, NFlex, NText } from 'naive-ui'
import type { AutoCompleteOption } from 'naive-ui'
import { useDebounceFn } from '@vueuse/core'
import { computed, h, ref, watch } from 'vue'
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
  'userInfoLoaded': [userInfo: BiliUserInfo | null]
}>()

// 使用 defineModel 作为外部 v-model:value 绑定
const model = defineModel<number | undefined>('value')

const inputValue = ref('')
const options = ref<BiliUserSelectorOption[]>([])
const loading = ref(false)
const selectedUserInfo = ref<BiliUserInfo | null>(null)

// 监听外部 v-model:value 变化，当外部设置了值时加载用户信息
watch(
  () => model.value,
  async (newValue) => {
    if (newValue) {
      inputValue.value = String(newValue)
      if (!selectedUserInfo.value || selectedUserInfo.value.mid !== newValue) {
        await loadUserInfo(newValue)
      }
    }
    else {
      inputValue.value = ''
      selectedUserInfo.value = null
    }
  },
  { immediate: true },
)

// 加载用户信息
async function loadUserInfo(uid: number) {
  try {
    loading.value = true
    const response = await fetch(`${VTSURU_API_URL}bili-user-info/${uid}`)
    const data: BiliApiResponse = await response.json()

    if (data.code === 0 && data.data?.card) {
      const userInfo = data.data.card
      selectedUserInfo.value = userInfo

      options.value = [{
        label: `${userInfo.name} (${userInfo.mid})`,
        value: String(userInfo.mid),
        userInfo,
      }] as BiliUserSelectorOption[]

      emit('userInfoLoaded', userInfo)
    }
    else {
      selectedUserInfo.value = null
      emit('userInfoLoaded', null)
    }
  }
  catch (error) {
    console.error('加载用户信息失败:', error)
    selectedUserInfo.value = null
    emit('userInfoLoaded', null)
  }
  finally {
    loading.value = false
  }
}

// 防抖搜索函数
const debouncedSearch = useDebounceFn(async (value: string) => {
  const uid = Number.parseInt(value)
  if (Number.isNaN(uid) || uid <= 0) {
    options.value = []
    return
  }

  await loadUserInfo(uid)
}, 500)

// 处理输入变化
function handleInput(value: string) {
  inputValue.value = value
  const uid = Number.parseInt(value)

  if (Number.isNaN(uid) || uid <= 0) {
    model.value = undefined
    selectedUserInfo.value = null
    options.value = []
    return
  }

  // 有效的数字输入时，立即同步给外部 v-model
  model.value = uid

  debouncedSearch(value)
}

// 处理选择
function handleSelect(value: string) {
  inputValue.value = value
  const numeric = Number.parseInt(value)
  model.value = Number.isNaN(numeric) ? undefined : numeric
  const option = options.value.find(opt => opt.value === value)
  if (option?.userInfo) {
    selectedUserInfo.value = option.userInfo
    emit('userInfoLoaded', option.userInfo)
  }
}

// 自定义渲染选项
function renderOption(option: { option: BiliUserSelectorOption }) {
  const { userInfo } = option.option
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
            referrerpolicy: 'no-referrer'
          }
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

// 计算当前显示的值 - 只显示UID
const displayValue = computed(() => {
  return inputValue.value
})
</script>

<template>
  <NAutoComplete
    :value="displayValue"
    :options="options"
    :loading="loading"
    :placeholder="placeholder || '请输入B站用户UID'"
    :size="size || 'medium'"
    :disabled="disabled"
    clearable
    :render-option="renderOption"
    @update:value="handleInput"
    @select="handleSelect"
  />
</template>
