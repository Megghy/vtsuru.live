<script setup lang="ts">
import { NEmpty } from 'naive-ui';
import { computed, toRef } from 'vue'
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

const topSubtitle = computed(() => {
  if (props.current.active) {
    return props.current.subtitle
  }
  return props.countText
})
</script>

<template>
  <div class="obs-minimal-card">
    <div class="obs-minimal-current">
      <span
        class="obs-minimal-indicator"
        :class="{ 'is-active': current.active }"
      />
      <div class="obs-minimal-current-title">
        {{ current.active ? current.title : current.emptyText }}
      </div>
      <div
        v-if="topSubtitle"
        class="obs-minimal-current-subtitle"
      >
        {{ topSubtitle }}
      </div>
    </div>

    <div
      v-if="current.active && (current.badges?.length ?? 0) > 0"
      class="obs-minimal-current-badges"
    >
      <span
        v-for="(badge, index) in current.badges ?? []"
        :key="`current-${index}-${badge.text}`"
        class="obs-minimal-chip"
        :data-tone="badge.tone ?? 'muted'"
      >
        {{ badge.text }}
      </span>
    </div>

    <div
      ref="listContainerRef"
      class="obs-minimal-list-container"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="obs-minimal-list-inner"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-minimal-transition"
            tag="div"
            class="obs-minimal-list"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="obs-minimal-item"
            >
              <div
                class="obs-minimal-index"
                :class="[`rank-${index + 1}`, { 'rank-top-3': index < 3 }]"
              >
                {{ index + 1 }}
              </div>
              <div class="obs-minimal-content">
                <div
                  class="obs-minimal-name"
                  :title="item.primary"
                >
                  {{ item.primary }}
                </div>
                <div
                  v-if="(item.badges?.length ?? 0) > 0"
                  class="obs-minimal-meta"
                >
                  <span
                    v-for="(badge, badgeIndex) in item.badges ?? []"
                    :key="`${item.id}-${badgeIndex}-${badge.text}`"
                    class="obs-minimal-chip"
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
        class="obs-minimal-empty"
        :description="emptyText"
      />
    </div>

    <div
      v-if="footerTags.length > 0"
      class="obs-minimal-footer"
    >
      <div class="obs-minimal-footer-grid">
        <div
          v-for="tag in footerTags"
          :key="tag.type"
          class="obs-minimal-footer-tag"
        >
          <span class="obs-minimal-tag-label">{{ tag.label }}</span>
          <span class="obs-minimal-tag-value">{{ tag.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-minimal-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  color: #fff;
  background: transparent;
}

.obs-minimal-current {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 6px 4px;
}

.obs-minimal-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.9);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.obs-minimal-indicator.is-active {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.9);
  animation: obs-minimal-breathe 1.6s ease-in-out infinite;
}

@keyframes obs-minimal-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.85; }
}

.obs-minimal-current-title {
  font-size: 14px;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 65%;
}

.obs-minimal-current-subtitle {
  font-size: 12px;
  opacity: 0.9;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}

.obs-minimal-current-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 4px 6px;
}

.obs-minimal-list-container {
  flex: 1;
  overflow: hidden;
}

.obs-minimal-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.obs-minimal-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.obs-minimal-index {
  min-width: 18px;
  text-align: center;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
}

.obs-minimal-index.rank-top-3 {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.9));
}

.obs-minimal-index.rank-1 {
  color: #fcd34d;
  text-shadow:
    0 0 6px rgba(252, 211, 77, 0.9),
    0 0 14px rgba(252, 211, 77, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.9);
}

.obs-minimal-index.rank-2 {
  color: #cbd5e1;
  text-shadow:
    0 0 6px rgba(203, 213, 225, 0.9),
    0 0 14px rgba(203, 213, 225, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.9);
}

.obs-minimal-index.rank-3 {
  color: #d97706;
  text-shadow:
    0 0 6px rgba(217, 119, 6, 0.9),
    0 0 14px rgba(217, 119, 6, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.9);
}

.obs-minimal-content {
  flex: 1;
  min-width: 0;
}

.obs-minimal-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.obs-minimal-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  opacity: 0.95;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
  flex-wrap: wrap;
}

.obs-minimal-chip {
  background: rgba(0, 0, 0, 0.35);
  padding: 1px 6px;
  border-radius: 999px;
  backdrop-filter: blur(2px);
  white-space: nowrap;
}

.obs-minimal-chip[data-tone='accent'] {
  color: #dbeafe;
}

.obs-minimal-chip[data-tone='danger'] {
  color: #fecdd3;
}

.obs-minimal-chip[data-tone='success'] {
  color: #bbf7d0;
}

.obs-minimal-empty {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.obs-minimal-transition-enter-active,
.obs-minimal-transition-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.obs-minimal-transition-enter-from,
.obs-minimal-transition-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes obs-minimal-vertical-ping-pong {
  0% { transform: translateY(0); }
  100% { transform: translateY(v-bind(animationTranslateYCss)); }
}

.obs-minimal-list-inner {
  pointer-events: none;
}

.obs-minimal-list-inner.animating {
  animation-name: obs-minimal-vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.obs-minimal-list-inner.animating:hover {
  animation-play-state: paused;
}

.obs-minimal-footer {
  margin-top: 6px;
  padding: 4px 4px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #e2e8f0;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}

.obs-minimal-footer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.obs-minimal-footer-tag {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
}

.obs-minimal-tag-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(226, 232, 240, 0.75);
  text-transform: uppercase;
  opacity: 0.8;
}

.obs-minimal-tag-value {
  margin-top: 0;
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
