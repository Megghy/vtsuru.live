<script setup lang="ts">
import { Search24Regular } from '@vicons/fluent'
import { computed } from 'vue'

import { OBS_CATEGORIES, getCategoryCounts, obsComponentList } from '@/apps/obs-store/registry'
import type { ObsCategory, ObsComponentStatus } from '@/apps/obs-store/registry'
import { Input } from '@/shared/ui/input'

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
  <div class="obs-store-header">
    <!-- 顶部标题与简要说明 -->
    <div class="header-main-row">
      <div class="title-block">
        <div class="flex items-center gap-2">
          <h1 class="page-title">OBS 独立组件</h1>
          <span class="ready-badge">{{ availableCount }} 个可用</span>
        </div>
        <p class="page-desc">收录独立 OBS 浏览器源。纯本地组件即开即用，需要同步的组件会在配置台保存并实时更新。</p>
      </div>

      <!-- 搜索框 -->
      <div class="search-box relative">
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

    <!-- 筛选工具栏 -->
    <div class="filter-bar">
      <!-- 分类选择按钮组 -->
      <div class="category-tabs">
        <button
          v-for="cat in OBS_CATEGORIES"
          :key="cat.id"
          type="button"
          class="category-tab-btn"
          :class="{ active: props.category === cat.id }"
          @click="emit('update:category', cat.id)"
        >
          <component
            :is="cat.icon"
            v-if="cat.icon"
            class="cat-icon"
          />
          <span class="cat-name">{{ cat.name }}</span>
          <span class="cat-count">{{ categoryCounts[cat.id] ?? 0 }}</span>
        </button>
      </div>

      <!-- 状态单选按钮组 -->
      <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
        <button
          v-for="opt in statusOptions"
          :key="opt.value"
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
          :class="
            props.statusFilter === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'
          "
          @click="emit('update:statusFilter', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-store-header {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.title-block {
  flex: 1;
  min-width: 0;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
}

.ready-badge {
  font-size: 11px;
  color: var(--muted-foreground);
  background: var(--muted);
  border: 1px solid var(--border);
  padding: 1px 7px;
  border-radius: 9999px;
  font-weight: 500;
}

.page-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 6px 0 0;
  line-height: 1.4;
}

.search-box {
  width: 260px;
  flex-shrink: 0;
}

/* 过滤工具栏 */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.category-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted-foreground);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.category-tab-btn:hover {
  background: var(--muted);
  color: var(--foreground);
}

.category-tab-btn.active {
  background: var(--popover);
  border-color: var(--border);
  color: var(--foreground);
  font-weight: 600;
}

.cat-icon {
  font-size: 14px;
}

.cat-count {
  font-size: 11px;
  background: var(--muted);
  padding: 0 5px;
  border-radius: 9999px;
  color: var(--muted-foreground);
}

.category-tab-btn.active .cat-count {
  background: var(--brand-soft);
  color: var(--brand);
}

@media (max-width: 768px) {
  .header-main-row {
    flex-direction: column;
    align-items: stretch;
  }
  .search-box {
    width: 100%;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
