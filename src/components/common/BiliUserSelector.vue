<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

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

interface BiliUserSelectorOption {
  label: string
  value: number
  description: string
  avatar: { src: string; alt: string }
  userInfo: BiliUserInfo
}

const props = defineProps<{
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
}>()

const emit = defineEmits<{
  userInfoLoaded: [userInfo: BiliUserInfo | null]
}>()

const model = defineModel<number | undefined>('value')
const searchTerm = ref('')
const options = ref<BiliUserSelectorOption[]>([])
const loading = ref(false)
const selectedUserInfo = ref<BiliUserInfo | null>(null)
const selectedUid = computed<number | null>({
  get: () => model.value ?? null,
  set: (value) => {
    model.value = value ?? undefined
  },
})

watch(
  model,
  async (uid) => {
    if (!uid) {
      searchTerm.value = ''
      selectedUserInfo.value = null
      return
    }

    searchTerm.value = String(uid)
    if (!selectedUserInfo.value || selectedUserInfo.value.mid !== uid) {
      await loadUserInfo(uid)
    }
  },
  { immediate: true },
)

async function loadUserInfo(uid: number) {
  loading.value = true
  try {
    const response = await fetch(`${VTSURU_API_URL}bili-user-info/${uid}`)
    const data: BiliApiResponse = await response.json()

    if (data.code !== 0 || !data.data?.card) {
      selectedUserInfo.value = null
      emit('userInfoLoaded', null)
      return
    }

    const userInfo = data.data.card
    selectedUserInfo.value = userInfo
    options.value = [
      {
        value: userInfo.mid,
        label: userInfo.name,
        description: `UID: ${userInfo.mid}`,
        avatar: { src: userInfo.face, alt: userInfo.name },
        userInfo,
      },
    ]
    emit('userInfoLoaded', userInfo)
  } catch (error) {
    console.error('加载用户信息失败:', error)
    selectedUserInfo.value = null
    emit('userInfoLoaded', null)
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(async (value: string) => {
  const uid = Number.parseInt(value)
  if (Number.isNaN(uid) || uid <= 0) {
    options.value = []
    return
  }

  await loadUserInfo(uid)
}, 500)

function handleSearchTerm(value: string) {
  searchTerm.value = value
  const uid = Number.parseInt(value)

  if (Number.isNaN(uid) || uid <= 0) {
    model.value = undefined
    selectedUserInfo.value = null
    options.value = []
    return
  }

  model.value = uid
  debouncedSearch(value)
}

function handleSelect(uid: number | null) {
  if (!uid) return

  searchTerm.value = String(uid)
  const selected = options.value.find((option) => option.value === uid)
  if (selected) {
    selectedUserInfo.value = selected.userInfo
    emit('userInfoLoaded', selected.userInfo)
  }
}
</script>

<template>
  <USelectMenu
    v-model="selectedUid"
    :items="options"
    value-key="value"
    :disabled="disabled"
    :size="size ?? 'md'"
    :placeholder="placeholder ?? '请输入B站用户UID'"
    :loading="loading"
    :search-term="searchTerm"
    :search-input="{ placeholder: '请输入B站用户UID' }"
    ignore-filter
    clear
    @update:search-term="handleSearchTerm"
    @update:model-value="handleSelect"
  />
</template>
