<script setup lang="ts">
import { Search24Regular } from '@vicons/fluent'
import {
  NFlex,
  NIcon,
  NInput,
  NRadioButton,
  NRadioGroup,
  NText,
} from 'naive-ui'
import { computed } from 'vue'

import {
  OBS_CATEGORIES,
  getCategoryCounts,
  getReadyComponentsCount,
} from '@/apps/obs-store/registry'
import type { ObsCategory, ObsComponentStatus } from '@/apps/obs-store/registry'

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
const readyCount = computed(() => getReadyComponentsCount())
</script>

<template>
  <div class="obs-store-header">
    <!-- 顶部标题与简要说明 -->
    <div class="header-main-row">
      <div class="title-block">
        <NFlex
          align="center"
          :size="8"
        >
          <h1 class="page-title">
            OBS 独立组件
          </h1>
          <span class="ready-badge">{{ readyCount }} 个就绪</span>
        </NFlex>
        <p class="page-desc">
          用于 OBS 浏览器源的独立小工具，无需登录或服务端。支持在网页端配置并与 OBS 画面实时同步。
        </p>
      </div>

      <!-- 搜索框 -->
      <div class="search-box">
        <NInput
          :value="props.search"
          placeholder="搜索组件或标签..."
          clearable
          size="small"
          @update:value="emit('update:search', $event)"
        >
          <template #prefix>
            <NIcon :component="Search24Regular" />
          </template>
        </NInput>
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
          <NIcon
            v-if="cat.icon"
            :component="cat.icon"
            class="cat-icon"
          />
          <span class="cat-name">{{ cat.name }}</span>
          <span class="cat-count">{{ categoryCounts[cat.id] ?? 0 }}</span>
        </button>
      </div>

      <!-- 状态单选 -->
      <div class="status-group">
        <NRadioGroup
          :value="props.statusFilter"
          size="small"
          @update:value="emit('update:statusFilter', $event)"
        >
          <NRadioButton value="all">
            全部
          </NRadioButton>
          <NRadioButton value="ready">
            已就绪
          </NRadioButton>
          <NRadioButton value="planned">
            规划中
          </NRadioButton>
        </NRadioGroup>
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
  color: var(--vtsuru-fg);
  margin: 0;
  line-height: 1.2;
}

.ready-badge {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  padding: 1px 7px;
  border-radius: 9999px;
  font-weight: 500;
}

.page-desc {
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
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
  border-bottom: 1px solid var(--vtsuru-border);
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
  color: var(--vtsuru-fg-muted);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.category-tab-btn:hover {
  background: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg);
}

.category-tab-btn.active {
  background: var(--vtsuru-bg-elevated);
  border-color: var(--vtsuru-border);
  color: var(--vtsuru-fg);
  font-weight: 600;
}

.cat-icon {
  font-size: 14px;
}

.cat-count {
  font-size: 11px;
  background: var(--vtsuru-bg-muted);
  padding: 0 5px;
  border-radius: 9999px;
  color: var(--vtsuru-fg-muted);
}

.category-tab-btn.active .cat-count {
  background: var(--vtsuru-brand-soft);
  color: var(--vtsuru-brand);
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
  .status-group {
    align-self: flex-start;
  }
}
</style>
