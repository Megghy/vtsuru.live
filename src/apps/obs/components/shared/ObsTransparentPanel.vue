<script setup lang="ts">
import { NEmpty } from 'naive-ui'
import { computed, toRef } from 'vue'

import type { ObsDisplayCurrent, ObsDisplayFooterTag, ObsDisplayItem } from './obsDisplay'
import { useObsListAnimation } from './useObsListAnimation'

const props = withDefaults(
  defineProps<{
    title: string
    countText: string
    current: ObsDisplayCurrent
    items: ObsDisplayItem[]
    footerTags?: ObsDisplayFooterTag[]
    speedMultiplier?: number
    emptyText: string
  }>(),
  {
    footerTags: () => [],
    speedMultiplier: 1,
  },
)

const { listContainerRef, listInnerRef, isMoreThanContainer, animationTranslateYCss, animationDurationCss } =
  useObsListAnimation(toRef(props, 'items'), toRef(props, 'speedMultiplier'))

const topSubtitle = computed(() => {
  if (props.current.active) {
    return props.current.subtitle
  }
  return props.countText
})
</script>

<template>
  <div class="obs-transparent-card">
    <!-- 头部当前处理中提示 -->
    <div class="obs-trans-header">
      <div class="obs-trans-current-row">
        <span class="obs-trans-dot" :class="{ 'is-active': current.active }" />
        <span class="obs-trans-status-tag">{{ current.active ? 'NOW' : 'IDLE' }}</span>
        <span class="obs-trans-current-title">{{ current.active ? current.title : current.emptyText }}</span>
      </div>
      <div v-if="topSubtitle && current.active" class="obs-trans-current-sub">
        {{ topSubtitle }}
      </div>
    </div>

    <!-- 列表容器 -->
    <div ref="listContainerRef" class="obs-trans-list-container">
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="obs-trans-list-inner"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup name="obs-trans-item-anim" tag="div" class="obs-trans-list">
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="obs-trans-item"
            >
              <span class="obs-trans-num" :class="{ 'rank-1': index === 0 }">
                #{{ index + 1 }}
              </span>
              <div class="obs-trans-content">
                <span class="obs-trans-primary">{{ item.primary }}</span>
                <span v-if="item.secondary" class="obs-trans-secondary">{{ item.secondary }}</span>
              </div>
              <div v-if="(item.badges?.length ?? 0) > 0" class="obs-trans-badges">
                <span
                  v-for="(badge, bIdx) in item.badges ?? []"
                  :key="`${item.id}-${bIdx}-${badge.text}`"
                  class="obs-trans-badge"
                >
                  {{ badge.text }}
                </span>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <NEmpty
        v-else
        class="obs-trans-empty"
        :description="emptyText"
      />
    </div>
  </div>
</template>

<style scoped>
.obs-transparent-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  padding: 4px;
  box-sizing: border-box;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.8),
    -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
}

.obs-trans-header {
  margin-bottom: 6px;
}

.obs-trans-current-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.obs-trans-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
}

.obs-trans-dot.is-active {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.obs-trans-status-tag {
  font-size: 11px;
  font-weight: 900;
  color: #67e8f9;
  letter-spacing: 0.5px;
}

.obs-trans-current-title {
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obs-trans-current-sub {
  font-size: 11px;
  color: #fde047;
  margin-left: 14px;
  margin-top: 1px;
}

.obs-trans-list-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.obs-trans-list-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.obs-trans-list-inner.animating {
  animation: obs-trans-scroll v-bind(animationDurationCss) linear infinite;
}

@keyframes obs-trans-scroll {
  0% { transform: translateY(0); }
  100% { transform: translateY(v-bind(animationTranslateYCss)); }
}

.obs-trans-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.obs-trans-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.obs-trans-num {
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
  width: 24px;
  flex-shrink: 0;
}

.obs-trans-num.rank-1 {
  color: #f59e0b;
}

.obs-trans-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.obs-trans-primary {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obs-trans-secondary {
  font-size: 11px;
  color: #cbd5e1;
}

.obs-trans-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.obs-trans-badge {
  font-size: 10px;
  font-weight: 700;
  color: #67e8f9;
}

.obs-trans-empty {
  margin-top: 30px;
}
</style>
