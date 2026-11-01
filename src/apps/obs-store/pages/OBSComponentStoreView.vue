<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ObsComponentCard from '@/apps/obs-store/components/store/ObsComponentCard.vue'
import ObsComponentWorkbench from '@/apps/obs-store/components/store/ObsComponentWorkbench.vue'
import ObsStoreHeader from '@/apps/obs-store/components/store/ObsStoreHeader.vue'
import { filterObsComponents, getObsComponentById } from '@/apps/obs-store/registry'
import type { ObsCategory, ObsComponentStatus, ObsComponentDefinition } from '@/apps/obs-store/registry'
import { firstQueryValue } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'

const route = useRoute()
const router = useRouter()

const category = ref<ObsCategory>('all')
const search = ref('')
const statusFilter = ref<ObsComponentStatus | 'all'>('all')
const selectedComponent = ref<ObsComponentDefinition | null>(null)

const components = computed(() =>
  filterObsComponents({
    category: category.value,
    search: search.value,
    status: statusFilter.value,
  }),
)

const queryComponentId = computed(() => firstQueryValue(route.query.component || route.query.active).trim())

function replaceQuery(component?: string) {
  const query = { ...route.query }
  delete query.active
  if (component) query.component = component
  else delete query.component
  return router.replace({ query }).catch(() => undefined)
}

function openConfig(item: ObsComponentDefinition) {
  if (!item.manageComponent || item.status === 'planned') return
  selectedComponent.value = item
  void replaceQuery(item.id)
}

function closeConfig() {
  selectedComponent.value = null
  void replaceQuery()
}

function resetFilters() {
  category.value = 'all'
  statusFilter.value = 'all'
  search.value = ''
}

watch(
  queryComponentId,
  (id) => {
    if (!id) {
      selectedComponent.value = null
      return
    }
    const item = getObsComponentById(id)
    if (!item || !item.manageComponent || item.status === 'planned') {
      selectedComponent.value = null
      void replaceQuery()
      return
    }
    selectedComponent.value = item
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="min-h-[calc(100dvh-var(--vtsuru-header-height))] py-5 px-6 pb-7 box-border max-w-[1480px] mx-auto max-sm:py-3.5 max-sm:px-3 max-sm:pb-5.5"
  >
    <!-- 全宽独立工作台视图模式 -->
    <ObsComponentWorkbench
      v-if="selectedComponent"
      :component="selectedComponent"
      @back="closeConfig"
    />

    <!-- 组件商店画廊索引模式 -->
    <template v-else>
      <ObsStoreHeader
        :category="category"
        :search="search"
        :status-filter="statusFilter"
        @update:category="category = $event"
        @update:search="search = $event"
        @update:status-filter="statusFilter = $event"
      />

      <div
        class="flex-between gap-3 -mt-1 mb-3.5 text-xs text-muted-foreground max-sm:flex-col max-sm:items-start max-sm:gap-1"
      >
        <span class="text-foreground font-semibold">{{ components.length }} 个组件</span>
        <span class="text-right max-sm:text-left">点击“配置与调试”进入控制台，OBS 源链接可直接复制</span>
      </div>

      <div
        v-if="components.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5 items-stretch max-sm:grid-cols-1"
      >
        <ObsComponentCard
          v-for="item in components"
          :key="item.id"
          :item="item"
          @configure="openConfig"
        />
      </div>

      <div
        v-else
        class="min-h-[280px] grid place-items-center border border-dashed border-border rounded-[var(--radius)] bg-popover"
      >
        <Empty description="没有匹配的组件">
          <template #extra>
            <Button
              variant="secondary"
              @click="resetFilters"
            >
              清除筛选
            </Button>
          </template>
        </Empty>
      </div>
    </template>
  </div>
</template>
