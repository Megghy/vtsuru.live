<script setup lang="ts">
import { NEmpty } from 'naive-ui';
import { toRef } from 'vue'
import type {
  ObsDisplayCurrent,
  ObsDisplayFooterTag,
  ObsDisplayItem,
} from './obsDisplay'
import { useObsListAnimation } from './useObsListAnimation'

const props = withDefaults(defineProps<{
  title: string
  countText: string
  current: ObsDisplayCurrent
  items: ObsDisplayItem[]
  footerTags?: ObsDisplayFooterTag[]
  speedMultiplier?: number
  emptyText: string
}>(), {
  footerTags: () => [],
  speedMultiplier: 1,
})

const {
  listContainerRef,
  listInnerRef,
  isMoreThanContainer,
  animationTranslateYCss,
  animationDurationCss,
} = useObsListAnimation(toRef(props, 'items'), toRef(props, 'speedMultiplier'))
</script>

<template>
  <div class="obs-fresh-card">
    <div class="obs-fresh-header">
      <h2 class="obs-fresh-title">
        {{ title }}
      </h2>
      <span class="obs-fresh-count">{{ countText }}</span>
    </div>

    <div class="obs-fresh-current">
      <div
        class="obs-fresh-current-indicator"
        :class="{ 'is-active': current.active }"
      />
      <div class="obs-fresh-current-content">
        <template v-if="current.active">
          <div class="obs-fresh-current-info">
            <div
              class="obs-fresh-current-title"
              :title="current.title"
            >
              {{ current.title }}
            </div>
            <div class="obs-fresh-current-meta">
              <img
                v-if="current.avatarUrl && !current.hideAvatar"
                class="obs-fresh-current-avatar"
                :src="current.avatarUrl"
                referrerpolicy="no-referrer"
              >
              <span
                v-if="current.subtitle"
                class="obs-fresh-current-subtitle"
              >
                {{ current.subtitle }}
              </span>
              <span
                v-for="(badge, index) in current.badges ?? []"
                :key="`current-${index}-${badge.text}`"
                class="obs-fresh-chip"
                :data-tone="badge.tone ?? 'muted'"
              >
                {{ badge.text }}
              </span>
            </div>
          </div>
        </template>
        <div
          v-else
          class="obs-fresh-current-empty"
        >
          {{ current.emptyText }}
        </div>
      </div>
    </div>

    <div
      ref="listContainerRef"
      class="obs-fresh-list-container"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="obs-fresh-list-inner"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-fresh-transition"
            tag="div"
            class="obs-fresh-transition-group"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="obs-fresh-item"
            >
              <div
                class="obs-fresh-rank"
                :class="[`rank-${index + 1}`, { 'rank-top-3': index < 3 }]"
              >
                {{ index + 1 }}
              </div>
              <div class="obs-fresh-item-content">
                <div
                  class="obs-fresh-item-primary"
                  :title="item.primary"
                >
                  {{ item.primary }}
                </div>
                <div
                  v-if="(item.badges?.length ?? 0) > 0"
                  class="obs-fresh-item-footer"
                >
                  <span
                    v-for="(badge, badgeIndex) in item.badges ?? []"
                    :key="`${item.id}-${badgeIndex}-${badge.text}`"
                    class="obs-fresh-chip"
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
        :description="emptyText"
        class="obs-fresh-empty"
      />
    </div>

    <div
      v-if="footerTags.length > 0"
      class="obs-fresh-footer"
    >
      <div class="obs-fresh-footer-tags">
        <div
          v-for="tag in footerTags"
          :key="tag.type"
          class="obs-fresh-footer-tag"
          :data-type="tag.type"
        >
          <span class="obs-fresh-tag-label">{{ tag.label }}</span>
          <span class="obs-fresh-tag-value">{{ tag.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-fresh-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 150px;
  min-width: 250px;
  max-height: 100vh;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(245, 245, 250, 0.85) 100%);
  border-radius: 16px;
  color: #333;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.obs-fresh-header {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.obs-fresh-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.obs-fresh-count {
  font-size: 12px;
  color: #475569;
  background-color: rgba(226, 232, 240, 0.7);
  padding: 4px 10px;
  border-radius: 16px;
  font-weight: 500;
}

.obs-fresh-current {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.5);
  margin: 10px 12px;
  border-radius: 12px;
  gap: 10px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.obs-fresh-current:has(.is-active) {
  background-color: rgba(236, 253, 245, 0.9);
  border-color: rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}

.obs-fresh-current-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #cbd5e1;
  flex-shrink: 0;
}

.obs-fresh-current-indicator.is-active {
  background-color: #10b981;
  animation: obs-fresh-breathe 1.8s infinite ease-in-out;
}

@keyframes obs-fresh-breathe {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 3px rgba(16, 185, 129, 0.2);
  }
  50% {
    transform: scale(1.2);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }
}

.obs-fresh-current-content {
  flex: 1;
  min-width: 0;
}

.obs-fresh-current-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obs-fresh-current-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  margin-top: 4px;
}

.obs-fresh-current-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
}

.obs-fresh-current-subtitle {
  font-size: 12px;
  color: #64748b;
}

.obs-fresh-current-empty {
  font-size: 13px;
  color: #94a3b8;
}

.obs-fresh-list-container {
  flex: 1;
  overflow: hidden !important;
  padding: 0 12px;
  margin-bottom: 8px;
  position: relative;
}

.obs-fresh-transition-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.obs-fresh-transition-enter-active,
.obs-fresh-transition-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.obs-fresh-transition-enter-from,
.obs-fresh-transition-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.obs-fresh-transition-leave-active {
  position: absolute;
  width: 100%;
}

.obs-fresh-transition-move {
  transition: transform 0.3s ease;
}

@keyframes obs-fresh-vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.obs-fresh-list-inner.animating {
  animation-name: obs-fresh-vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.obs-fresh-list-inner.animating:hover {
  animation-play-state: paused;
}

.obs-fresh-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
}

.obs-fresh-rank {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #64748b;
  background: rgba(226, 232, 240, 0.85);
  flex-shrink: 0;
}

.obs-fresh-rank.rank-top-3.rank-1 {
  background: rgba(251, 191, 36, 0.16);
  color: #b45309;
}

.obs-fresh-rank.rank-top-3.rank-2 {
  background: rgba(203, 213, 225, 0.75);
  color: #475569;
}

.obs-fresh-rank.rank-top-3.rank-3 {
  background: rgba(251, 146, 60, 0.16);
  color: #c2410c;
}

.obs-fresh-item-content {
  flex: 1;
  min-width: 0;
}

.obs-fresh-item-primary {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obs-fresh-item-footer {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.obs-fresh-chip {
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.72);
  color: #475569;
  white-space: nowrap;
}

.obs-fresh-chip[data-tone='accent'] {
  color: #1d4ed8;
  background: rgba(191, 219, 254, 0.6);
}

.obs-fresh-chip[data-tone='success'] {
  color: #047857;
  background: rgba(167, 243, 208, 0.5);
}

.obs-fresh-chip[data-tone='warning'] {
  color: #b45309;
  background: rgba(253, 230, 138, 0.55);
}

.obs-fresh-chip[data-tone='danger'] {
  color: #be123c;
  background: rgba(251, 207, 232, 0.6);
}

.obs-fresh-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.obs-fresh-footer {
  flex-shrink: 0;
  padding: 0 12px 12px;
}

.obs-fresh-footer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.obs-fresh-footer-tag {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.obs-fresh-footer-tag[data-type='prefix'],
.obs-fresh-footer-tag[data-type='keyword'] {
  background: rgba(219, 234, 254, 0.72);
}

.obs-fresh-footer-tag[data-type='allow'] {
  background: rgba(220, 252, 231, 0.72);
}

.obs-fresh-footer-tag[data-type='sc'],
.obs-fresh-footer-tag[data-type='gift'] {
  background: rgba(251, 207, 232, 0.68);
}

.obs-fresh-footer-tag[data-type='price'] {
  background: rgba(254, 240, 138, 0.7);
}

.obs-fresh-footer-tag[data-type='gift-names'] {
  background: rgba(233, 213, 255, 0.7);
}

.obs-fresh-footer-tag[data-type='medal'] {
  background: rgba(254, 202, 202, 0.68);
}

.obs-fresh-tag-label {
  font-size: 10px;
  color: #64748b;
}

.obs-fresh-tag-value {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}
</style>
