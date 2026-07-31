<script setup lang="ts">
import { Checkmark24Regular, Clock24Regular, Person24Regular, Question24Regular } from '@vicons/fluent'
import { NIcon, NTag } from 'naive-ui'

import type { VideoCollectVideo, VideoInfo } from '@/api/api-models'

defineProps<{
  item: { info: VideoInfo; video: VideoCollectVideo }
  index: number
  presentation?: 'plain' | 'flip'
  revealed?: boolean
  watched?: boolean
}>()

defineEmits<{
  select: []
}>()

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}
</script>

<template>
  <button
    type="button"
    class="video-result-card"
    :class="{
      'is-flip': presentation === 'flip',
      'is-revealed': revealed,
      'is-watched': watched,
    }"
    :aria-label="revealed || presentation === 'plain' ? `打开视频：${item.video.title}` : `揭晓第 ${index + 1} 个视频`"
    @click="$emit('select')"
  >
    <div class="video-result-card__stage">
      <div class="video-result-card__content">
        <div class="video-result-card__media">
          <img
            :src="item.video.cover.replace('http://', 'https://')"
            :alt="item.video.title"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <span class="duration">
            <NIcon :component="Clock24Regular" />
            {{ formatDuration(item.video.length) }}
          </span>
        </div>
        <div class="video-result-card__details">
          <div class="title-row">
            <strong>{{ item.video.title }}</strong>
            <NTag
              v-if="watched"
              size="tiny"
              type="success"
              :bordered="false"
            >
              已观看
            </NTag>
          </div>
          <span class="owner">
            <NIcon :component="Person24Regular" />
            {{ item.video.ownerName }}
          </span>
          <p v-if="item.video.description">
            {{ item.video.description }}
          </p>
        </div>
      </div>

      <div class="mystery-face">
        <span class="mystery-number">{{ String(index + 1).padStart(2, '0') }}</span>
        <NIcon :component="Question24Regular" />
        <strong>点击翻牌</strong>
      </div>

      <span
        v-if="revealed && presentation === 'flip'"
        class="revealed-action"
      >
        <NIcon :component="Checkmark24Regular" />
        再次点击观看
      </span>
    </div>
  </button>
</template>

<style scoped>
.video-result-card {
  --result-card-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --result-card-muted: var(
    --vtsuru-block-fg-muted,
    var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--vtsuru-fg-muted)))
  );
  --result-card-bg: var(
    --vtsuru-block-bg-muted,
    var(--vtsuru-page-card-bg, var(--user-page-theme-surface-bg, var(--vtsuru-bg-muted)))
  );
  --result-card-border: var(
    --vtsuru-block-border,
    var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)))
  );
  --result-card-accent: var(--vtsuru-page-primary, var(--vtsuru-brand));

  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  color: var(--result-card-fg);
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  perspective: 1000px;
  cursor: pointer;
}

.video-result-card__stage {
  position: relative;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius, 8px);
  transform-style: preserve-3d;
}

.video-result-card__content,
.mystery-face {
  overflow: hidden;
  background: var(--result-card-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--result-card-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
  backface-visibility: hidden;
  transition:
    transform 0.46s cubic-bezier(0.2, 0.75, 0.25, 1),
    border-color 0.18s ease;
}

.video-result-card:hover .video-result-card__content,
.video-result-card:focus-visible .video-result-card__content {
  border-color: var(--result-card-accent);
}

.video-result-card:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary-focus, var(--result-card-accent));
  outline-offset: 3px;
  border-radius: var(--vtsuru-page-radius, 8px);
}

.video-result-card__media {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--vtsuru-page-card-bg-embedded, var(--result-card-bg));
}

.video-result-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    filter 0.35s ease,
    transform 0.35s ease;
}

.video-result-card:hover .video-result-card__media img {
  transform: scale(1.025);
}

.duration {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 7px;
  color: #fff;
  font-size: 11px;
  line-height: 1;
  background: rgb(0 0 0 / 72%);
  border-radius: 4px;
}

.video-result-card__details {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 106px;
  padding: 12px;
}

.title-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
}

.title-row strong {
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.owner {
  display: flex;
  gap: 5px;
  align-items: center;
  overflow: hidden;
  color: var(--result-card-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-result-card__details p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--result-card-muted);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.is-watched .video-result-card__content {
  opacity: 0.78;
}

.revealed-action {
  position: absolute;
  z-index: 3;
  display: flex;
  gap: 7px;
  align-items: center;
}

.revealed-action {
  right: 8px;
  bottom: 8px;
  padding: 5px 8px;
  color: var(--vtsuru-page-primary-readable, var(--result-card-fg));
  font-size: 11px;
  background: var(--result-card-accent);
  border-radius: 4px;
  animation: action-enter 0.28s cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.mystery-face {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: var(--vtsuru-page-primary-readable, var(--result-card-accent));
  background: linear-gradient(var(--vtsuru-page-primary-soft), var(--vtsuru-page-primary-soft)), var(--result-card-bg);
  transform: rotateY(0deg);
}

.mystery-face .n-icon {
  font-size: 36px;
}

.mystery-number {
  position: absolute;
  top: 14px;
  left: 16px;
  color: var(--result-card-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}

.is-flip .mystery-face {
  display: flex;
}

.is-flip:not(.is-revealed) .video-result-card__content {
  transform: rotateY(-180deg);
}

.is-flip.is-revealed .mystery-face {
  transform: rotateY(180deg);
}

@keyframes action-enter {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .video-result-card__content,
  .mystery-face,
  .video-result-card__media img {
    transition: none;
  }

  .revealed-action {
    animation: none;
  }
}
</style>
