<script setup lang="ts">
import { ArrowDownWideNarrow, ArrowUpNarrowWide, EyeOff, RotateCcw, Search, Share2, Shuffle } from 'lucide-vue-next'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import {
  PUBLIC_OPTION_FILTER_ITEMS,
  PUBLIC_SORT_ITEMS,
  type SongListPublicOptionFilter,
  type SongListPublicSortKey,
} from '../utils/useSongListQueryState'

interface OptionItem {
  label: string
  value: string
}

withDefaults(
  defineProps<{
    artistOptions?: OptionItem[]
    languageOptions?: OptionItem[]
    tagOptions?: OptionItem[]
    totalCount: number
    filteredCount: number
    disabledCount?: number
    hasFilters: boolean
    density?: 'full' | 'compact'
    showOptionFilter?: boolean
    showSort?: boolean
    showRandom?: boolean
    showShare?: boolean
  }>(),
  {
    artistOptions: () => [],
    languageOptions: () => [],
    tagOptions: () => [],
    disabledCount: 0,
    density: 'full',
    showOptionFilter: true,
    showSort: true,
    showRandom: true,
    showShare: true,
  },
)

const emit = defineEmits<{
  clear: []
  random: []
  share: []
}>()

const searchKeyword = defineModel<string>('searchKeyword', { default: '' })
const selectedArtist = defineModel<string | null>('selectedArtist', { default: null })
const selectedLanguage = defineModel<string | null>('selectedLanguage', { default: null })
const selectedTag = defineModel<string | null>('selectedTag', { default: null })
const selectedOption = defineModel<SongListPublicOptionFilter>('selectedOption', { default: 'all' })
const sortKey = defineModel<SongListPublicSortKey>('sortKey', { default: 'default' })
const sortOrder = defineModel<'asc' | 'desc'>('sortOrder', { default: 'asc' })
const hideDisabled = defineModel<boolean>('hideDisabled', { default: false })
</script>

<template>
  <div class="space-y-2.5 min-w-0">
    <!-- 第一行：搜索 + 排序 -->
    <div class="flex flex-col sm:flex-row gap-2 min-w-0">
      <div class="relative flex-1 min-w-0">
        <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="searchKeyword"
          placeholder="搜索歌名、歌手、语言、标签或备注"
          class="pl-8 w-full"
        />
      </div>

      <div
        v-if="showSort"
        class="flex items-center gap-1 sm:w-44 shrink-0 min-w-0"
      >
        <Select
          :model-value="sortKey"
          @update:model-value="sortKey = $event as SongListPublicSortKey"
        >
          <SelectTrigger class="flex-1 min-w-0">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in PUBLIC_SORT_ITEMS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          v-if="sortKey !== 'default'"
          variant="ghost"
          size="icon-sm"
          class="shrink-0 text-muted-foreground"
          :aria-label="sortOrder === 'asc' ? '升序' : '降序'"
          @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
        >
          <component
            :is="sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow"
            class="size-4"
          />
        </Button>
      </div>
    </div>

    <!-- 第二行：多维筛选等宽对齐，避免孤立换行 -->
    <div
      class="grid gap-2 min-w-0"
      :class="showOptionFilter && density === 'full' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'"
    >
      <Select
        :model-value="selectedArtist || 'all'"
        @update:model-value="selectedArtist = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-full min-w-0">
          <SelectValue placeholder="歌手" />
        </SelectTrigger>
        <SelectContent class="max-h-60">
          <SelectItem value="all">全部歌手</SelectItem>
          <SelectItem
            v-for="opt in artistOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        :model-value="selectedLanguage || 'all'"
        @update:model-value="selectedLanguage = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-full min-w-0">
          <SelectValue placeholder="语言" />
        </SelectTrigger>
        <SelectContent class="max-h-60">
          <SelectItem value="all">全部语言</SelectItem>
          <SelectItem
            v-for="opt in languageOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        :model-value="selectedTag || 'all'"
        @update:model-value="selectedTag = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-full min-w-0">
          <SelectValue placeholder="标签" />
        </SelectTrigger>
        <SelectContent class="max-h-60">
          <SelectItem value="all">全部标签</SelectItem>
          <SelectItem
            v-for="opt in tagOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        v-if="showOptionFilter && density === 'full'"
        :model-value="selectedOption"
        @update:model-value="selectedOption = $event as SongListPublicOptionFilter"
      >
        <SelectTrigger class="w-full min-w-0">
          <SelectValue placeholder="点歌条件" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in PUBLIC_OPTION_FILTER_ITEMS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-border/50">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-muted-foreground font-mono tabular-nums"> {{ filteredCount }} / {{ totalCount }} 首 </span>

        <Button
          v-if="disabledCount > 0"
          :variant="hideDisabled ? 'secondary' : 'ghost'"
          size="xs"
          class="gap-1"
          @click="hideDisabled = !hideDisabled"
        >
          <EyeOff class="size-3" />
          {{ hideDisabled ? '已隐藏暂不接歌' : `隐藏暂不接歌 (${disabledCount})` }}
        </Button>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <Button
          v-if="hasFilters"
          variant="ghost"
          size="xs"
          class="gap-1 text-muted-foreground"
          @click="emit('clear')"
        >
          <RotateCcw class="size-3" />
          清空
        </Button>

        <Button
          v-if="showShare"
          variant="ghost"
          size="xs"
          class="gap-1 text-muted-foreground"
          @click="emit('share')"
        >
          <Share2 class="size-3" />
          分享筛选
        </Button>

        <Button
          v-if="showRandom"
          variant="secondary"
          size="xs"
          class="gap-1"
          :disabled="totalCount === 0"
          @click="emit('random')"
        >
          <Shuffle class="size-3" />
          随机一首
        </Button>
      </div>
    </div>
  </div>
</template>
