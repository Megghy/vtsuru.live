<script setup lang="ts">
import { NDivider, NEmpty } from 'naive-ui';
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

const loopFooterTags = computed(() => [...props.footerTags, ...props.footerTags])

const {
  listContainerRef,
  listInnerRef,
  isMoreThanContainer,
  animationTranslateYCss,
  animationDurationCss,
  scrollStyle,
} = useObsListAnimation(toRef(props, 'items'), toRef(props, 'speedMultiplier'))
</script>

<template>
  <div class="obs-classic-card">
    <p class="obs-classic-header">
      {{ title }}
    </p>
    <NDivider class="obs-classic-divider">
      <p class="obs-classic-count">
        {{ countText }}
      </p>
    </NDivider>

    <div
      class="obs-classic-current"
      :active="current.active"
    >
      <div class="obs-classic-current-prefix" />
      <template v-if="current.active">
        <img
          v-if="current.avatarUrl && !current.hideAvatar"
          class="obs-classic-current-avatar"
          :src="current.avatarUrl"
          referrerpolicy="no-referrer"
        >
        <div class="obs-classic-current-body">
          <p class="obs-classic-current-title">
            {{ current.title }}
          </p>
          <p
            v-if="current.subtitle"
            class="obs-classic-current-subtitle"
          >
            {{ current.subtitle }}
          </p>
        </div>
      </template>
      <div
        v-else
        class="obs-classic-current-empty"
      >
        {{ current.emptyText }}
      </div>
    </div>

    <div
      ref="listContainerRef"
      class="obs-classic-content"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="obs-classic-list"
          :class="{ animating: isMoreThanContainer }"
          :style="scrollStyle"
        >
          <TransitionGroup
            name="obs-classic-transition"
            tag="div"
            class="obs-classic-transition-group"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="obs-classic-item"
            >
              <div
                class="obs-classic-item-index"
                :index="index + 1"
              >
                {{ index + 1 }}
              </div>
              <div class="obs-classic-item-scroll-view">
                <div class="obs-classic-item-inner-scroll">
                  <div class="obs-classic-item-primary">
                    {{ item.primary }}
                  </div>
                  <div
                    v-for="(badge, badgeIndex) in item.badges ?? []"
                    :key="`${item.id}-${badgeIndex}-${badge.text}`"
                    class="obs-classic-item-badge"
                    :data-tone="badge.tone ?? 'muted'"
                  >
                    {{ badge.text }}
                  </div>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <div
        v-else
        class="obs-classic-empty-wrapper"
      >
        <NEmpty :description="emptyText" />
      </div>
    </div>

    <div
      v-if="footerTags.length > 0"
      class="obs-classic-footer"
    >
      <div class="obs-classic-footer-info">
        <div class="obs-classic-footer-tags">
          <div
            v-for="(tag, index) in loopFooterTags"
            :key="`${tag.type}-${index}`"
            class="obs-classic-footer-tag"
            :data-type="tag.type"
          >
            <span class="obs-classic-tag-label">{{ tag.label }}</span>
            <span class="obs-classic-tag-value">{{ tag.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-classic-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 100px;
  min-width: 100px;
  background-color: #0f0f0f48;
  border-radius: 10px;
  color: white;
}

.obs-classic-header {
  margin: 0;
  color: #fff;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  text-shadow:
    0 0 10px #ca7b7b6e,
    0 0 20px #ffffff8e,
    0 0 30px #61606086,
    0 0 40px rgba(64, 156, 179, 0.555);
}

.obs-classic-count {
  color: #ffffffbd;
  text-align: center;
  font-size: 14px;
}

.obs-classic-divider {
  margin: 0 auto;
  margin-top: -15px;
  margin-bottom: -15px;
  width: 90%;
}

.obs-classic-current {
  min-height: 35px;
  margin: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.obs-classic-current-empty {
  font-weight: bold;
  font-style: italic;
  color: #ffffffbe;
}

.obs-classic-current-prefix {
  border: 2px solid rgb(231, 231, 231);
  height: 30px;
  width: 10px;
  border-radius: 10px;
}

.obs-classic-current[active='true'] .obs-classic-current-prefix {
  background-color: #75c37f;
  animation: obs-classic-pulse 3s linear infinite;
}

.obs-classic-current[active='false'] .obs-classic-current-prefix {
  background-color: #c37575;
}

.obs-classic-current-avatar {
  height: 30px;
  border-radius: 50%;
  animation: obs-classic-rotate 20s linear infinite;
}

.obs-classic-current-body {
  min-width: 0;
}

.obs-classic-current-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.obs-classic-current-subtitle {
  margin: 0;
  font-size: 12px;
  font-style: italic;
  color: rgba(255, 255, 255, 0.82);
}

@keyframes obs-classic-rotate {
  0% {
    transform: rotate(0);
  }

  100% {
    transform: rotate(360deg);
  }
}

.n-divider__line {
  background-color: #ffffffd5;
}

.obs-classic-content {
  background-color: #0f0f0f4f;
  margin: 10px;
  padding: 8px;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
}

.obs-classic-list {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.obs-classic-transition-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
}

.obs-classic-transition-enter-active,
.obs-classic-transition-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.obs-classic-transition-enter-from,
.obs-classic-transition-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.obs-classic-transition-leave-active {
  position: absolute;
  width: 100%;
}

.obs-classic-transition-move {
  transition: transform 0.3s ease;
}

@keyframes obs-classic-vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.obs-classic-list.animating {
  animation-name: obs-classic-vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.obs-classic-list.animating:hover {
  animation-play-state: paused;
}

.obs-classic-item {
  display: flex;
  align-self: flex-start;
  position: relative;
  align-items: center;
  gap: 5px;
  padding: 4px 6px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  min-height: 36px;
  overflow: hidden;
}

.obs-classic-item-scroll-view {
  flex-grow: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.obs-classic-item-inner-scroll {
  display: flex;
  align-items: center;
  gap: 5px;
  width: max-content;
  animation: obs-classic-item-horizontal-scroll 5s infinite alternate ease-in-out;
}

.obs-classic-item:hover .obs-classic-item-inner-scroll {
  animation-play-state: paused;
}

@keyframes obs-classic-item-horizontal-scroll {
  from {
    transform: translateX(0px);
  }
  to {
    transform: translateX(min(0px, calc(var(--item-parent-width) - 100% - 5px)));
  }
}

.obs-classic-item-primary {
  font-size: 16px;
  font-weight: bold;
  white-space: nowrap;
  margin-right: 5px;
}

.obs-classic-item-badge {
  font-size: 12px;
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
  flex-shrink: 0;
  background-color: rgba(0, 0, 0, 0.2);
  color: rgba(204, 204, 204, 0.993);
}

.obs-classic-item-badge[data-tone='accent'] {
  font-style: italic;
  font-weight: bold;
  color: #d2d8d6;
}

.obs-classic-item-badge[data-tone='danger'] {
  color: rgba(233, 165, 165, 0.993);
}

.obs-classic-item-badge[data-tone='success'] {
  color: #bef264;
}

.obs-classic-item-index {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
  flex-shrink: 0;
}

.obs-classic-item-index[index='1'] {
  background-color: #ebc34c;
  color: white;
  font-weight: bold;
  text-shadow: 0 0 6px #ebc34c;
}

.obs-classic-item-index[index='2'] {
  background-color: #c0c0c0;
  color: white;
  font-weight: bold;
}

.obs-classic-item-index[index='3'] {
  background-color: #b87333;
  color: white;
  font-weight: bold;
}

.obs-classic-empty-wrapper {
  position: relative;
  top: 20%;
}

.obs-classic-footer {
  margin: 0 5px 5px 5px;
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  padding: 8px 6px;
  overflow: hidden;
  min-height: 40px;
  max-height: 60px;
  display: flex;
  align-items: center;
}

.obs-classic-footer-info {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.obs-classic-footer-tags {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 2px 16px 2px 2px;
  white-space: nowrap;
  animation: obs-classic-scroll-tags 25s linear infinite;
}

@keyframes obs-classic-scroll-tags {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.obs-classic-footer-tags:hover {
  animation-play-state: paused;
}

.obs-classic-footer-tag {
  display: inline-flex;
  flex-direction: column;
  padding: 5px 8px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.12);
  min-width: max-content;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.obs-classic-footer-tag[data-type='prefix'],
.obs-classic-footer-tag[data-type='keyword'] {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.18));
}

.obs-classic-footer-tag[data-type='allow'] {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.18));
}

.obs-classic-footer-tag[data-type='sc'],
.obs-classic-footer-tag[data-type='gift'] {
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.12), rgba(219, 39, 119, 0.18));
}

.obs-classic-footer-tag[data-type='price'] {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.18));
}

.obs-classic-footer-tag[data-type='gift-names'] {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(124, 58, 237, 0.18));
}

.obs-classic-footer-tag[data-type='medal'] {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.18));
}

.obs-classic-tag-label {
  font-size: 10px;
  opacity: 0.8;
  color: #e5e7eb;
  margin-bottom: 2px;
  line-height: 1;
}

.obs-classic-tag-value {
  font-size: 12px;
  font-weight: 600;
  color: white;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes obs-classic-pulse {
  0% {
    box-shadow: 0 0 0px #589580;
  }
  100% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
}
</style>
