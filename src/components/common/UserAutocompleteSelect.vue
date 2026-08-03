<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { ref, watch } from 'vue'

import { QueryGetAPI } from '@/api/query'
import { USER_API_URL } from '@/shared/config'

interface UserAutocompleteInfo {
  id: number
  name: string
  biliUid: number | null
  isBiliAuthed: boolean
  faceUrl?: string
  streamerName?: string
}

interface UserOption {
  label: string
  value: number
}

const props = defineProps<{
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  limit?: number
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

const model = defineModel<number | null>('value')
const loading = ref(false)
const options = ref<UserOption[]>([])

function toOption(user: UserAutocompleteInfo): UserOption {
  const bili = user.biliUid ? ` | UID: ${user.biliUid}` : ''
  const streamer = user.streamerName ? ` | ${user.streamerName}` : ''

  return {
    value: user.id,
    label: `${user.name}${streamer}${bili} (ID: ${user.id})`,
  }
}

async function fetchOptions(query: string) {
  const keyword = query.trim()
  if (!keyword) {
    options.value = []
    return
  }

  loading.value = true
  try {
    const response = await QueryGetAPI<UserAutocompleteInfo[]>(`${USER_API_URL}autocomplete`, {
      q: keyword,
      limit: props.limit,
    })

    if (response.code !== 200) {
      options.value = []
      emit('error', response.message)
      return
    }

    options.value = (response.data ?? []).map(toOption)
  } catch (error) {
    options.value = []
    emit('error', error instanceof Error ? error.message : '搜索用户失败')
  } finally {
    loading.value = false
  }
}

const debouncedFetch = useDebounceFn(fetchOptions, 250)

watch(
  model,
  async (userId) => {
    if (!userId || options.value.some((option) => option.value === userId)) return
    await fetchOptions(String(userId))
  },
  { immediate: true },
)
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="options"
    value-key="value"
    :disabled="disabled"
    :size="size ?? 'sm'"
    :placeholder="placeholder ?? '输入B站UID/用户名搜索(可选)'"
    :loading="loading"
    :search-input="{ placeholder: '输入B站UID/用户名搜索' }"
    ignore-filter
    clear
    @update:search-term="debouncedFetch"
  />
</template>
