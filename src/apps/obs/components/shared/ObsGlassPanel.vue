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
  <div class="obs-glass-card">
    <!-- 顶栏状态与标题 -->
    <div class="obs-glass-header">
      <div class="obs-glass-title-row">
        <span class="obs-glass-dot" :class="{ 'is-active': current.active }" />
        <span class="obs-glass-header-title">{{ title }}</span>
        <span v-if="countText" class="obs-glass-badge">{{ countText }}</span>
      </div>

      <!-- 当前进行中内容 -->
      <div class="obs-glass-current-box" :class="{ 'is-active': current.active }">
        <div class="obs-glass-current-label">
          {{ current.active ? '当前处理' : '当前空闲' }}
        </div>
        <div class="obs-glass-current-name">
          {{ current.active ? current.title : current.emptyText }}
        </div>
        <div v-if="topSubtitle && current.active" class="obs-glass-current-sub">
          {{ topSubtitle }}
        </div>
      </div>
    </div>

    <!-- 滚动列表容器 -->
    <div ref="listContainerRef" class="obs-glass-list-container">
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="obs-glass-list-inner"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup name="obs-glass-item-anim" tag="div" class="obs-glass-list">
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="obs-glass-item"
            >
              <div
                class="obs-glass-rank"
                :class="[`rank-${index + 1}`, { 'rank-top-3': index < 3 }]"
              >
                {{ index + 1 }}
              </div>
              <div class="obs-glass-content">
                <div class="obs-glass-primary" :title="item.primary">
                  {{ item.primary }}
                </div>
                <div v-if="item.secondary" class="obs-glass-secondary">
                  {{ item.secondary }}
                </div>
                <div v-if="(item.badges?.length ?? 0) > 0" class="obs-glass-badges">
                  <span
                    v-for="(badge, bIdx) in item.badges ?? []"
                    :key="`${item.id}-${bIdx}-${badge.text}`"
                    class="obs-glass-chip"
                    :data-tone="badge.tone ?? 'muted'"
                  >
                    {{ badge.text }}
                  </span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <NEmpty
        v-else
        class="obs-glass-empty"
        :description="emptyText"
      />
    </div>

    <!-- 底部标签 -->
    <div v-if="footerTags.length > 0" class="obs-glass-footer">
      <div v-for="tag in footerTags" :key="tag.type" class="obs-glass-footer-tag">
        <span class="tag-lbl">{{ tag.label }}</span>
        <span class="tag-val">{{ tag.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-glass-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  color: #fff;
  overflow: hidden;
  box-sizing: border-box;
  font-variant-numeric: tabular-nums;
}

.obs-glass-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.obs-glass-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.obs-glass-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.obs-glass-dot.is-active {
  background: #22c55e;
  box-shadow: 0 0 10px #22c55e;
  animation: glass-pulse 1.8s infinite;
}

@keyframes glass-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

.obs-glass-header-title {
  font-size: 15px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: 0.5px;
}

.obs-glass-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  margin-left: auto;
}

.obs-glass-current-box {
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.obs-glass-current-box.is-active {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.15));
  border-color: rgba(34, 197, 94, 0.3);
}

.obs-glass-current-label {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
}

.obs-glass-current-name {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  margin-top: 2px;
}

.obs-glass-current-sub {
  font-size: 11px;
  color: #cbd5e1;
  margin-top: 2px;
}

/* 列表容器 */
.obs-glass-list-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.obs-glass-list-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.obs-glass-list-inner.animating {
  animation: obs-glass-scroll v-bind(animationDurationCss) linear infinite;
}

@keyframes obs-glass-scroll {
  0% { transform: translateY(0); }
  100% { transform: translateY(v-bind(animationTranslateYCss)); }
}

.obs-glass-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.obs-glass-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s ease;
}

.obs-glass-rank {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #cbd5e1;
  flex-shrink: 0;
}

.obs-glass-rank.rank-1 { background: #f59e0b; color: #000; box-shadow: 0 0 8px rgba(245, 158, 11, 0.5); }
.obs-glass-rank.rank-2 { background: #94a3b8; color: #000; }
.obs-glass-rank.rank-3 { background: #b45309; color: #fff; }

.obs-glass-content {
  flex: 1;
  min-width: 0;
}

.obs-glass-primary {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.obs-glass-secondary {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}

.obs-glass-badges {
  display: flex;
  gap: 4px;
  margin-top: 3px;
}

.obs-glass-chip {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

.obs-glass-chip[data-tone="highlight"] {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.obs-glass-chip[data-tone="success"] {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.obs-glass-empty {
  margin-top: 40px;
}

.obs-glass-footer {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.obs-glass-footer-tag {
  font-size: 11px;
  display: flex;
  gap: 4px;
}

.tag-lbl { color: #64748b; }
.tag-val { color: #cbd5e1; font-weight: 600; }
</style>
