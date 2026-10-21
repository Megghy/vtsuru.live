<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { getApiUserAutocomplete } from '@/api/generated/user/user'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

export interface SelectOption {
  label: string
  value: number
}

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

const open = ref(false)
const searchInput = ref('')
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
    const resp = (await getApiUserAutocomplete({
      q: keyword,
      limit: props.limit,
    })) as unknown as {
      code: number
      message?: string
      data?: UserAutocompleteInfo[]
    }

    if (resp.code !== 200) {
      options.value = []
      emit('error', resp.message || '搜索失败')
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

function onSearchInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  searchInput.value = val
  debouncedFetch(val)
}

function selectOption(opt: SelectOption) {
  model.value = opt.value
  searchInput.value = opt.label
  open.value = false
}

function clearSelection() {
  model.value = null
  searchInput.value = ''
  options.value = []
}

const selectedLabel = computed(() => {
  if (!model.value) return ''
  const hit = options.value.find((o) => o.value === model.value)
  return hit ? hit.label : `用户 ID: ${model.value}`
})

watch(
  () => model.value,
  async (v) => {
    if (!v) {
      searchInput.value = ''
      return
    }
    if (options.value.some((o) => o.value === v)) {
      searchInput.value = selectedLabel.value
      return
    }
    await fetchOptions(String(v))
    searchInput.value = selectedLabel.value
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative w-full select-none">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <div
          class="flex items-center justify-between w-full h-8 px-2.5 text-xs rounded-md border border-input bg-background transition-colors hover:border-ring cursor-pointer"
          :class="[disabled ? 'opacity-50 pointer-events-none' : '']"
        >
          <span v-if="selectedLabel" class="truncate text-foreground">{{ selectedLabel }}</span>
          <span v-else class="text-muted-foreground">{{ placeholder || '输入B站UID/用户名搜索(可选)' }}</span>
          <div class="flex items-center gap-1 ml-1 text-muted-foreground">
            <button
              v-if="model && !disabled"
              type="button"
              class="hover:text-foreground p-0.5 rounded"
              @click.stop="clearSelection"
            >
              <X class="size-3" />
            </button>
            <ChevronsUpDown class="size-3.5 opacity-50" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent class="w-[320px] p-2 text-xs" align="start">
        <div class="relative mb-2">
          <input
            type="text"
            class="w-full h-7 px-2 pr-7 text-xs rounded border border-input bg-background placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            :placeholder="placeholder || '输入B站UID/用户名搜索...'"
            :value="searchInput"
            @input="onSearchInput"
          />
          <Loader2 v-if="loading" class="absolute right-2 top-1.5 size-3.5 animate-spin text-muted-foreground" />
        </div>
        <div class="max-h-56 overflow-y-auto space-y-0.5">
          <div
            v-for="opt in options"
            :key="opt.value"
            class="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors"
            :class="opt.value === model ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'"
            @click="selectOption(opt)"
          >
            <span class="truncate pr-2">{{ opt.label }}</span>
            <Check v-if="opt.value === model" class="size-3.5 shrink-0" />
          </div>
          <div v-if="!loading && options.length === 0" class="py-4 text-center text-muted-foreground text-[11px]">
            {{ searchInput ? '未找到匹配用户' : '请输入关键字开始搜索' }}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
