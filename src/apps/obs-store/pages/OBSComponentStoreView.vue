<script lang="ts" setup>
import {
  AddCircleOutline,
  AppsOutline,
  GameControllerOutline,
  LayersOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import {
  computed,
  defineAsyncComponent,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  OBS_CATEGORIES,
  getObsComponentById,
  obsComponentList,
} from '@/apps/obs-store/registry'
import type {
  ObsCategory,
  ObsComponentDefinition,
} from '@/apps/obs-store/registry'

const route = useRoute()
const router = useRouter()
const message = useMessage()

// 当前激活的组件 ID（默认 counter，或从 url 初始化）
const activeId = ref<string>(
  (route.query.component as string) || (route.query.active as string) || 'counter',
)

const readyList = computed(() => obsComponentList.filter((c) => c && c.status === 'ready'))
const plannedList = computed(() => obsComponentList.filter((c) => c && c.status === 'planned'))

// 当前激活的组件定义
const activeComponent = computed<ObsComponentDefinition | null>(() => {
  const found = getObsComponentById(activeId.value)
  return found || readyList.value[0] || obsComponentList[0] || null
})

// 动态加载组件的控制台视图
const activeManageComponent = computed(() => {
  if (activeComponent.value?.manageComponent) {
    return defineAsyncComponent(activeComponent.value.manageComponent)
  }
  return null
})

function formatItemTitle(name?: string): string {
  if (!name || typeof name !== 'string') return ''
  const idx = name.indexOf('(')
  return idx > 0 ? name.slice(0, idx).trim() : name.trim()
}

function selectComponent(item?: ObsComponentDefinition) {
  if (!item) return
  if (item.status === 'planned') {
    message.info(`${item.name || '该组件'} 尚在开发规划中，敬请期待`)
    return
  }
  activeId.value = item.id
  syncUrl()
}

function syncUrl() {
  router.replace({
    query: {
      ...route.query,
      component: activeId.value,
      active: undefined,
    },
  }).catch(() => {})
}

watch(
  () => route.query.component || route.query.active,
  (newVal) => {
    if (newVal && typeof newVal === 'string' && newVal !== activeId.value) {
      activeId.value = newVal
    }
  },
)

</script>

<template>
  <div class="obs-studio-page">
    <!-- 顶部状态栏 -->
    <header class="studio-header">
      <div class="header-left">
        <div class="header-badge">
          OBS 独立组件工作台
        </div>
        <h1 class="header-title">
          直播挂件与工具控制台
        </h1>
        <p class="header-desc">
          无服务端与账号依赖。在网页端即时修改并与 OBS 画面毫秒级双向同步。
        </p>
      </div>

      <div class="header-right">
        <div class="sync-status-indicator">
          <span class="status-dot-pulse" />
          <span class="status-text">实时 Hash 状态同步</span>
        </div>
      </div>
    </header>

    <!-- 主体双栏工作区 -->
    <div class="studio-workspace">
      <!-- 左侧：组件导航 Deck -->
      <aside class="component-nav-deck">
        <div class="nav-section-label">
          已就绪组件 ({{ readyList.length }})
        </div>

        <div class="nav-list">
          <button
            v-for="item in readyList"
            :key="item.id"
            type="button"
            class="nav-item-card"
            :class="{ active: activeId === item.id }"
            @click="selectComponent(item)"
          >
            <div class="item-icon-box">
              <NIcon
                :component="item.icon"
                class="item-icon"
              />
            </div>
            <div class="item-info">
              <div class="item-title-row">
                <span class="item-name">{{ formatItemTitle(item?.name) }}</span>
                <span class="ready-tag">就绪</span>
              </div>
              <span class="item-short-desc">{{ item.shortDescription }}</span>
            </div>
          </button>
        </div>

        <!-- 规划中组件 -->
        <template v-if="plannedList.length > 0">
          <div class="nav-section-label planned-section">
            规划中组件 ({{ plannedList.length }})
          </div>

          <div class="nav-list">
            <button
              v-for="item in plannedList"
              :key="item.id"
              type="button"
              class="nav-item-card is-planned"
              @click="selectComponent(item)"
            >
              <div class="item-icon-box">
                <NIcon
                  :component="item.icon"
                  class="item-icon"
                />
              </div>
              <div class="item-info">
                <div class="item-title-row">
                  <span class="item-name">{{ formatItemTitle(item?.name) }}</span>
                  <span class="planned-tag">规划中</span>
                </div>
                <span class="item-short-desc">{{ item.shortDescription }}</span>
              </div>
            </button>
          </div>
        </template>
      </aside>

      <!-- 右侧：当前组件的专有工作台 -->
      <main
        v-if="activeComponent"
        class="active-workbench"
      >
        <component
          :is="activeManageComponent"
          v-if="activeManageComponent"
          :key="activeComponent.id"
        />

        <div
          v-else
          class="planned-placeholder"
        >
          <NEmpty
            description="该组件尚在规划设计中，敬请期待后续上线"
            size="large"
          >
            <template #extra>
              <NText depth="3">
                {{ activeComponent?.description || '' }}
              </NText>
            </template>
          </NEmpty>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.obs-studio-page {
  padding: 16px 20px 24px;
  box-sizing: border-box;
  max-width: 1440px;
  margin: 0 auto;
}

/* 顶部状态栏 */
.studio-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--vtsuru-border);
  margin-bottom: 16px;
  gap: 16px;
}

.header-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vtsuru-brand);
  margin-bottom: 4px;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  margin: 0 0 4px;
  line-height: 1.2;
}

.header-desc {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  margin: 0;
  line-height: 1.4;
}

.sync-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  color: var(--vtsuru-fg);
  user-select: none;
}

.status-dot-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

/* 主体双栏工作区 */
.studio-workspace {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: start;
}

/* 左侧导航 */
.component-nav-deck {
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 6px;
}

.nav-section-label.planned-section {
  margin-top: 10px;
  border-top: 1px dashed var(--vtsuru-border);
  padding-top: 10px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-item-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  width: 100%;
}

.nav-item-card:hover {
  background: var(--vtsuru-bg-muted);
  border-color: var(--vtsuru-brand);
}

.nav-item-card.active {
  background: var(--vtsuru-bg-muted);
  border-color: var(--vtsuru-brand);
  box-shadow: 0 0 0 1px var(--vtsuru-brand);
}

.nav-item-card.is-planned {
  opacity: 0.7;
}

.nav-item-card.is-planned:hover {
  border-color: var(--vtsuru-border);
}

.item-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--vtsuru-brand-soft);
  color: var(--vtsuru-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-icon {
  font-size: 18px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ready-tag {
  font-size: 10px;
  font-weight: 600;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}

.planned-tag {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-short-desc {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
  margin-top: 2px;
}

/* 右侧工作台 */
.active-workbench {
  min-width: 0;
}

.planned-placeholder {
  background: var(--vtsuru-bg-elevated);
  border: 1px dashed var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  padding: 60px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 900px) {
  .studio-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
