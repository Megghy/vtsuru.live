<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import { NSelect } from 'naive-ui';
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

const props = defineProps<{
  placeholder?: string
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  limit?: number
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

const model = defineModel<number | null>('value')

const loading = ref(false)
const options = ref<SelectOption[]>([])

function toOption(u: UserAutocompleteInfo): SelectOption {
  const bili = u.biliUid ? ` | UID: ${u.biliUid}` : ''
  const streamer = u.streamerName ? ` | ${u.streamerName}` : ''
  return {
    value: u.id,
    label: `${u.name}${streamer}${bili} (ID: ${u.id})`,
  }
}

async function fetchOptions(q: string) {
  const keyword = q.trim()
  if (!keyword) {
    options.value = []
    return
  }

  loading.value = true
  try {
    const resp = await QueryGetAPI<UserAutocompleteInfo[]>(`${USER_API_URL}autocomplete`, {
      q: keyword,
      limit: props.limit,
    })

    if (resp.code !== 200) {
      options.value = []
      emit('error', resp.message)
      return
    }

    options.value = (resp.data ?? []).map(toOption)
  } catch (err) {
    options.value = []
    emit('error', err instanceof Error ? err.message : '搜索用户失败')
  } finally {
    loading.value = false
  }
}

const debouncedFetch = useDebounceFn(fetchOptions, 250)

function handleSearch(query: string) {
  debouncedFetch(query)
}

watch(
  () => model.value,
  async (v) => {
    if (!v) return
    if (options.value.some(o => o.value === v)) return
    await fetchOptions(String(v))
  },
  { immediate: true },
)
</script>

<template>
  <NSelect
    v-model:value="model"
    filterable
    remote
    clearable
    :disabled="disabled"
    :size="size || 'small'"
    :placeholder="placeholder || '输入B站UID/用户名搜索(可选)'"
    :loading="loading"
    :options="options"
    @search="handleSearch"
  />
</template>
