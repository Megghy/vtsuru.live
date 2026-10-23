<script setup lang="ts">
import { Search24Regular } from '@vicons/fluent'
import { computed } from 'vue'

import { OBS_CATEGORIES, getCategoryCounts, obsComponentList } from '@/apps/obs-store/registry'
import type { ObsCategory, ObsComponentStatus } from '@/apps/obs-store/registry'
import { Input } from '@/shared/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = defineProps<{
  category: ObsCategory
  search: string
  statusFilter: ObsComponentStatus | 'all'
}>()

const emit = defineEmits<{
  'update:category': [value: ObsCategory]
  'update:search': [value: string]
  'update:statusFilter': [value: ObsComponentStatus | 'all']
}>()

const categoryCounts = computed(() => getCategoryCounts())
const availableCount = computed(() => obsComponentList.filter((item) => item.status !== 'planned').length)

const statusOptions: { label: string; value: ObsComponentStatus | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '已就绪', value: 'ready' },
  { label: '内测', value: 'beta' },
  { label: '规划中', value: 'planned' },
]
</script>

<template>
  <div class="mb-5 flex flex-col gap-4">
    <div class="flex justify-between items-start gap-4 max-md:flex-col max-md:items-stretch">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="m-0 text-lg font-semibold text-foreground leading-tight">OBS 独立组件</h1>
          <span
            class="text-[11px] text-muted-foreground bg-muted border border-border py-px px-1.5 rounded-full font-medium"
          >
            {{ availableCount }} 个可用
          </span>
        </div>
        <p class="mt-1.5 mb-0 text-[13px] text-muted-foreground leading-snug">
          收录独立 OBS 浏览器源。纯本地组件即开即用，需要同步的组件会在配置台保存并实时更新。
        </p>
      </div>

      <div class="relative w-[260px] shrink-0 max-md:w-full">
        <Search24Regular
          class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          :value="props.search"
          placeholder="搜索组件或标签..."
          class="pl-8 w-full"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="flex-between flex-wrap gap-3 pb-3 border-b border-border max-md:flex-col max-md:items-stretch">
      <ToggleGroup
        type="single"
        :model-value="props.category"
        class="flex-wrap h-auto gap-1 bg-transparent border-none p-0 justify-start"
        @update:model-value="(val) => val && emit('update:category', val as ObsCategory)"
      >
        <ToggleGroupItem
          v-for="cat in OBS_CATEGORIES"
          :key="cat.id"
          :value="cat.id"
          class="gap-1.5 h-control-sm px-2.5 rounded-md border border-transparent data-[state=on]:bg-card data-[state=on]:border-border data-[state=on]:font-semibold data-[state=on]:shadow-xs hover:bg-muted"
        >
          <component
            :is="cat.icon"
            v-if="cat.icon"
          />
          <span>{{ cat.name }}</span>
          <span
            class="text-[11px] bg-muted px-1.5 rounded-full text-muted-foreground leading-normal"
            :class="{
              'bg-primary/10 text-primary font-medium': props.category === cat.id,
            }"
          >
            {{ categoryCounts[cat.id] ?? 0 }}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup
        type="single"
        :model-value="props.statusFilter"
        @update:model-value="(val) => val && emit('update:statusFilter', val as ObsComponentStatus | 'all')"
      >
        <ToggleGroupItem
          v-for="opt in statusOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  </div>
</template>
