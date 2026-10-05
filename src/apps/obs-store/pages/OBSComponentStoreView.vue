<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NEmpty } from 'naive-ui'

import ObsComponentCard from '@/apps/obs-store/components/store/ObsComponentCard.vue'
import ObsComponentDrawer from '@/apps/obs-store/components/store/ObsComponentDrawer.vue'
import ObsStoreHeader from '@/apps/obs-store/components/store/ObsStoreHeader.vue'
import { filterObsComponents, getObsComponentById } from '@/apps/obs-store/registry'
import type { ObsCategory, ObsComponentStatus, ObsComponentDefinition } from '@/apps/obs-store/registry'
import { firstQueryValue } from '@/shared/obs/obsUrl'

const route = useRoute()
const router = useRouter()

const category = ref<ObsCategory>('all')
const search = ref('')
const statusFilter = ref<ObsComponentStatus | 'all'>('all')
const showDrawer = ref(false)
const selectedComponent = ref<ObsComponentDefinition | null>(null)

const components = computed(() => filterObsComponents({
  category: category.value,
  search: search.value,
  status: statusFilter.value,
}))

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
  showDrawer.value = true
  void replaceQuery(item.id)
}

function closeConfig() {
  showDrawer.value = false
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
      showDrawer.value = false
      return
    }
    const item = getObsComponentById(id)
    if (!item || !item.manageComponent || item.status === 'planned') {
      selectedComponent.value = null
      showDrawer.value = false
      void replaceQuery()
      return
    }
    selectedComponent.value = item
    showDrawer.value = true
  },
  { immediate: true },
)
</script>

<template>
  <div class="obs-store-page">
    <ObsStoreHeader
      :category="category"
      :search="search"
      :status-filter="statusFilter"
      @update:category="category = $event"
      @update:search="search = $event"
      @update:status-filter="statusFilter = $event"
    />

    <div class="catalog-toolbar">
      <span class="result-count">{{ components.length }} 个组件</span>
      <span class="catalog-hint">点击“配置与调试”打开配置台，OBS 源链接可直接复制</span>
    </div>

    <div
      v-if="components.length"
      class="component-grid"
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
      class="empty-state"
    >
      <NEmpty description="没有匹配的组件">
        <template #extra>
          <NButton
            size="small"
            secondary
            @click="resetFilters"
          >
            清除筛选
          </NButton>
        </template>
      </NEmpty>
    </div>

    <ObsComponentDrawer
      v-model:show="showDrawer"
      :component="selectedComponent"
      @update:show="(value) => { if (!value) closeConfig() }"
    />
  </div>
</template>

<style scoped>
.obs-store-page {
  min-height: calc(100dvh - var(--vtsuru-header-height));
  padding: 20px 24px 28px;
  box-sizing: border-box;
  max-width: 1480px;
  margin: 0 auto;
}

.catalog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -4px 0 14px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.result-count {
  color: var(--vtsuru-fg);
  font-weight: 600;
}

.catalog-hint {
  text-align: right;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  align-items: stretch;
}

.empty-state {
  min-height: 280px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
}

@media (max-width: 640px) {
  .obs-store-page {
    padding: 14px 12px 22px;
  }

  .catalog-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .catalog-hint {
    text-align: left;
  }

  .component-grid {
    grid-template-columns: 1fr;
  }
}
</style>
