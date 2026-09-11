<script setup lang="ts">
import {
  ArrowSwap24Regular,
  Checkmark24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Comment24Regular,
  Heart24Regular,
  Open24Regular,
  Person24Regular,
  Question24Regular,
} from '@vicons/fluent'
import { NIcon, NTag } from 'naive-ui'
import { computed } from 'vue'

import type { VideoCollectVideo, VideoInfo } from '@/api/api-models'

const props = withDefaults(
  defineProps<{
    item: { info: VideoInfo; video: VideoCollectVideo }
    index: number
    presentation?: 'plain' | 'flip'
    revealed?: boolean
    watched?: boolean
    featured?: boolean
  }>(),
  {
    presentation: 'plain',
    revealed: true,
    watched: false,
    featured: false,
  },
)

const emit = defineEmits<{
  select: []
  toggleWatched: []
  toggleReveal: []
}>()

const primarySender = computed(() => props.item.info.senders[0])
const otherSendersCount = computed(() => Math.max(0, props.item.info.senders.length - 1))

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function handleCardClick() {
  if (props.presentation === 'flip' && !props.revealed) {
    emit('toggleReveal')
  } else {
    emit('select')
  }
}
</script>

<template>
  <article
    class="video-result-card"
    :class="{
      'is-flip': presentation === 'flip',
      'is-revealed': revealed,
      'is-watched': watched,
      'is-featured': featured,
    }"
    :aria-label="revealed || presentation === 'plain' ? `视频：${item.video.title}` : `第 ${index + 1} 个待翻牌视频`"
  >
    <div class="video-result-card__stage">
      <!-- 正面内容 -->
      <div
        class="video-result-card__content"
        @click="handleCardClick"
      >
        <div class="video-result-card__media">
          <img
            :src="item.video.cover.replace('http://', 'https://')"
            :alt="item.video.title"
            loading="eager"
            referrerpolicy="no-referrer"
          />

          <!-- 分区标签 -->
          <span
            v-if="item.video.partitionName"
            class="media-badge partition-badge"
          >
            {{ item.video.partitionName }}
          </span>

          <!-- 时长 -->
          <span class="media-badge duration-badge">
            <NIcon :component="Clock24Regular" />
            {{ formatDuration(item.video.length) }}
          </span>

          <!-- 快速已看切换按钮 -->
          <button
            type="button"
            class="watch-toggle-btn"
            :class="{ 'is-active': watched }"
            :title="watched ? '标记为未看' : '标记为已看'"
            :aria-label="watched ? '标记为未看' : '标记为已看'"
            @click.stop.prevent="emit('toggleWatched')"
          >
            <NIcon :component="watched ? CheckmarkCircle24Regular : Checkmark24Regular" />
            <span>{{ watched ? '已看' : '未看' }}</span>
          </button>
        </div>

        <div class="video-result-card__details">
          <!-- 标题与外链 -->
          <div class="title-row">
            <strong
              class="video-title"
              :title="item.video.title"
            >
              {{ item.video.title }}
            </strong>
            <button
              type="button"
              class="open-link-btn"
              title="在哔哩哔哩打开"
              aria-label="在哔哩哔哩打开"
              @click.stop.prevent="emit('select')"
            >
              <NIcon :component="Open24Regular" />
            </button>
          </div>

          <!-- UP 主与 BV 号 -->
          <div class="meta-row">
            <span
              class="owner"
              :title="`UP 主: ${item.video.ownerName}`"
            >
              <NIcon :component="Person24Regular" />
              <span class="owner-name">{{ item.video.ownerName }}</span>
            </span>
            <code class="bvid-code">{{ item.info.bvid }}</code>
          </div>

          <!-- 粉丝推荐理由 (最核心展示区) -->
          <div
            v-if="primarySender"
            class="recommend-block"
          >
            <div class="recommend-author">
              <span class="sender-tag">
                <NIcon :component="Heart24Regular" />
                <span class="sender-name">{{ primarySender.sender || '匿名粉丝' }}</span>
              </span>
              <NTag
                v-if="otherSendersCount > 0"
                size="tiny"
                :bordered="false"
                class="extra-senders-tag"
              >
                +{{ otherSendersCount }} 人推荐
              </NTag>
            </div>
            <p
              v-if="primarySender.description"
              class="recommend-quote"
              :title="primarySender.description"
            >
              <NIcon
                :component="Comment24Regular"
                class="quote-icon"
              />
              <span>{{ primarySender.description }}</span>
            </p>
            <span
              v-else
              class="recommend-empty-note"
              >推荐了此视频</span
            >
          </div>

          <!-- 若无推荐人但有 B 站原简介 -->
          <p
            v-else-if="item.video.description"
            class="video-desc"
            :title="item.video.description"
          >
            {{ item.video.description }}
          </p>

          <!-- 兜底占位，防止高频切换时因缺块产生高度跳动 -->
          <div
            v-else
            class="empty-desc-slot"
          >
            <span class="empty-desc-text">暂无补充说明</span>
          </div>
        </div>

        <!-- 翻牌模式下已揭晓的角标与盖上按钮 -->
        <div
          v-if="revealed && presentation === 'flip'"
          class="flip-revealed-bar"
          @click.stop
        >
          <span class="flip-order">#{{ String(index + 1).padStart(2, '0') }}</span>
          <button
            type="button"
            class="flip-back-btn"
            title="重新盖上"
            @click.stop="emit('toggleReveal')"
          >
            <NIcon :component="ArrowSwap24Regular" />
            盖上
          </button>
        </div>
      </div>

      <!-- 背面内容（翻牌盲盒面） -->
      <button
        type="button"
        class="mystery-face"
        :aria-label="`点击翻开第 ${index + 1} 个视频`"
        @click.stop="emit('toggleReveal')"
      >
        <div class="mystery-pattern" />
        <span class="mystery-number">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="mystery-center">
          <div class="mystery-icon-circle">
            <NIcon :component="Question24Regular" />
          </div>
          <strong class="mystery-text">点击揭晓</strong>
          <span class="mystery-hint">TAP TO REVEAL</span>
        </div>
      </button>
    </div>
  </article>
</template>

<style scoped>
.video-result-card {
  --result-card-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --result-card-muted: var(
    --vtsuru-block-fg-muted,
    --vtsuru-surface-fg-muted,
    var(--text-color-2, var(--vtsuru-fg-muted))
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

  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  color: var(--result-card-fg);
  font: inherit;
  perspective: 1200px;
}

.video-result-card__stage {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  border-radius: var(--vtsuru-page-radius, 10px);
  transform-style: preserve-3d;
}

.video-result-card__content,
.mystery-face {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--result-card-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--result-card-border);
  border-radius: var(--vtsuru-page-radius, 10px);
  box-shadow: var(--vtsuru-page-shadow);
  backface-visibility: hidden;
  transition:
    transform 0.5s cubic-bezier(0.2, 0.8, 0.25, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.video-result-card__content {
  cursor: pointer;
}

.video-result-card:hover .video-result-card__content {
  border-color: color-mix(in srgb, var(--result-card-accent) 60%, var(--result-card-border));
  transform: translateY(-2px);
}

.is-featured .video-result-card__content {
  box-shadow: 0 10px 30px -10px color-mix(in srgb, var(--result-card-accent) 25%, transparent);
}

.video-result-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  flex: 0 0 auto;
  overflow: hidden;
  background: var(--vtsuru-page-card-bg-embedded, var(--result-card-bg));
}

.video-result-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}

.video-result-card:hover .video-result-card__media img {
  transform: scale(1.035);
}

.media-badge {
  position: absolute;
  z-index: 2;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 3px 6px;
  color: #fff;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  background: rgb(0 0 0 / 72%);
  backdrop-filter: blur(4px);
  border-radius: 4px;
  pointer-events: none;
}

.partition-badge {
  top: 8px;
  left: 8px;
  font-weight: 500;
  background: rgb(0 0 0 / 60%);
}

.duration-badge {
  right: 8px;
  bottom: 8px;
}

.watch-toggle-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 4px 8px;
  color: rgb(255 255 255 / 88%);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  background: rgb(0 0 0 / 65%);
  backdrop-filter: blur(6px);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.watch-toggle-btn:hover {
  background: rgb(0 0 0 / 85%);
  border-color: rgb(255 255 255 / 40%);
  transform: scale(1.05);
}

.watch-toggle-btn.is-active {
  color: #fff;
  background: color-mix(in srgb, #10b981 85%, #000);
  border-color: #10b981;
}

.video-result-card__details {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 126px;
  padding: 12px;
  box-sizing: border-box;
}

/* 焦点卡片（抽取舞台与逐看舞台）严格锁定内容高度，确保任何视频切换零抖动 */
.is-featured .video-result-card__details {
  height: 148px;
  min-height: 148px;
  max-height: 148px;
  overflow: hidden;
}

.is-featured .video-title {
  height: 2.8em;
  line-height: 1.4;
  margin-bottom: 0;
}

.is-featured .recommend-block,
.is-featured .video-desc,
.is-featured .empty-desc-slot {
  height: 56px;
  min-height: 56px;
  max-height: 56px;
  margin-top: auto;
  overflow: hidden;
  box-sizing: border-box;
}

.title-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  justify-content: space-between;
}

.video-title {
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  transition: color 0.18s ease;
}

.video-result-card:hover .video-title {
  color: var(--result-card-accent);
}

.open-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--result-card-muted);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.open-link-btn:hover {
  color: var(--result-card-accent);
  background: color-mix(in srgb, var(--result-card-accent) 12%, transparent);
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--result-card-muted);
}

.owner {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.owner-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bvid-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  color: var(--result-card-muted);
  opacity: 0.75;
}

.recommend-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--result-card-accent) 7%, transparent);
  border-left: 3px solid var(--result-card-accent);
  border-radius: 0 6px 6px 0;
}

.recommend-author {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
}

.sender-tag {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--result-card-accent);
  font-weight: 600;
  min-width: 0;
}

.sender-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extra-senders-tag {
  font-size: 10px;
  padding: 0 4px;
  height: 18px;
}

.recommend-quote {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--result-card-fg);
  font-size: 12px;
  line-height: 1.4;
  font-style: italic;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  opacity: 0.92;
}

.recommend-empty-note {
  font-size: 11px;
  color: var(--result-card-muted);
}

.quote-icon {
  margin-right: 4px;
  font-size: 12px;
  vertical-align: -1px;
  color: var(--result-card-accent);
}

.video-desc {
  display: -webkit-box;
  margin: auto 0 0;
  overflow: hidden;
  color: var(--result-card-muted);
  font-size: 12px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.empty-desc-slot {
  display: flex;
  align-items: center;
  margin: auto 0 0;
  padding: 4px 8px;
  color: var(--result-card-muted);
  font-size: 11px;
  background: color-mix(in srgb, var(--result-card-border) 20%, transparent);
  border-radius: 4px;
}

.empty-desc-text {
  opacity: 0.7;
}

.is-watched .video-result-card__content {
  opacity: 0.65;
  filter: grayscale(0.2);
}

.is-watched:hover .video-result-card__content {
  opacity: 0.92;
  filter: none;
}

/* 翻牌模式角标与快捷控制 */
.flip-revealed-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px dashed var(--result-card-border);
  background: color-mix(in srgb, var(--result-card-bg) 80%, transparent);
}

.flip-order {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--result-card-accent);
}

.flip-back-btn {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--result-card-muted);
  background: transparent;
  border: 1px solid var(--result-card-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.flip-back-btn:hover {
  color: var(--result-card-accent);
  border-color: var(--result-card-accent);
}

/* 背面样式（神秘盲盒面） */
.mystery-face {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--result-card-accent);
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--result-card-accent) 18%, transparent), transparent 70%),
    var(--result-card-bg);
  border: 1px solid color-mix(in srgb, var(--result-card-accent) 30%, var(--result-card-border));
  cursor: pointer;
  text-align: center;
  box-sizing: border-box;
}

.mystery-face:hover {
  border-color: var(--result-card-accent);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--result-card-accent) 25%, transparent);
}

.mystery-pattern {
  position: absolute;
  inset: 8px;
  border: 1px dashed color-mix(in srgb, var(--result-card-accent) 30%, transparent);
  border-radius: calc(var(--vtsuru-page-radius, 10px) - 4px);
  pointer-events: none;
}

.mystery-number {
  position: absolute;
  top: 14px;
  left: 16px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--result-card-muted);
  opacity: 0.8;
}

.mystery-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 1;
}

.mystery-icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  font-size: 26px;
  color: var(--result-card-accent);
  background: color-mix(in srgb, var(--result-card-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--result-card-accent) 25%, transparent);
  border-radius: 50%;
  transition: transform 0.25s ease;
}

.mystery-face:hover .mystery-icon-circle {
  transform: scale(1.1) rotate(6deg);
}

.mystery-text {
  font-size: 15px;
  letter-spacing: 1px;
}

.mystery-hint {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--result-card-muted);
  letter-spacing: 1.5px;
  opacity: 0.7;
}

/* 翻转机制 */
.is-flip .mystery-face {
  display: flex;
}

.is-flip:not(.is-revealed) .video-result-card__content {
  transform: rotateY(-180deg);
  pointer-events: none;
}

.is-flip:not(.is-revealed) .mystery-face {
  transform: rotateY(0deg);
}

.is-flip.is-revealed .video-result-card__content {
  transform: rotateY(0deg);
}

.is-flip.is-revealed .mystery-face {
  transform: rotateY(180deg);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .video-result-card__content,
  .mystery-face,
  .video-result-card__media img,
  .mystery-icon-circle {
    transition: none !important;
  }
}
</style>
