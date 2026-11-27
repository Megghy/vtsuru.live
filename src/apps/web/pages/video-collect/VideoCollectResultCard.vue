<script setup lang="ts">
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Heart,
  HelpCircle,
  MessageSquare,
  Play,
  Radio,
  User,
} from 'lucide-vue-next'
import { computed } from 'vue'

import type { VideoCollectInfo, VideoData } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { formatVideoDuration, normalizeBiliCoverUrl } from '@/shared/utils/videoCollect'

const props = withDefaults(
  defineProps<{
    item: { info: VideoCollectInfo; video: VideoData }
    index: number
    presentation?: 'plain' | 'flip'
    revealed?: boolean
    watched?: boolean
    featured?: boolean
    canPushObs?: boolean
  }>(),
  {
    presentation: 'plain',
    revealed: true,
    watched: false,
    featured: false,
    canPushObs: false,
  },
)

const emit = defineEmits<{
  select: []
  play: []
  pushToObs: []
  toggleWatched: []
  toggleReveal: []
}>()

const primarySender = computed(() => props.item.info.senders[0])
const otherSendersCount = computed(() => Math.max(0, props.item.info.senders.length - 1))
const coverUrl = computed(() => normalizeBiliCoverUrl(props.item.video.cover))
const videoPage = computed(() => Math.max(1, props.item.info.page || 1))

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
            :src="coverUrl"
            :alt="item.video.title"
            loading="eager"
            referrerpolicy="no-referrer"
          />

          <!-- 分区与分 P 标签 -->
          <span
            v-if="item.video.partitionName || videoPage > 1"
            class="media-badge partition-badge"
          >
            <template v-if="item.video.partitionName">{{ item.video.partitionName }}</template>
            <template v-if="item.video.partitionName && videoPage > 1"> · </template>
            <template v-if="videoPage > 1">P{{ videoPage }}</template>
          </span>

          <!-- 时长 -->
          <span class="media-badge duration-badge">
            <Clock class="size-3" />
            {{ formatVideoDuration(item.video.length) }}
          </span>

          <!-- 快速已看切换按钮 -->
          <Button
            variant="ghost"
            size="none"
            class="watch-toggle-btn"
            :class="{ 'is-active': watched }"
            :aria-label="watched ? '标记为未看' : '标记为已看'"
            @click.stop.prevent="emit('toggleWatched')"
          >
            <CheckCircle2
              v-if="watched"
              class="size-3.5"
            />
            <Check
              v-else
              class="size-3.5"
            />
            <span>{{ watched ? '已看' : '未看' }}</span>
          </Button>
        </div>

        <div class="video-result-card__details">
          <!-- 标题与快捷操作 -->
          <div class="title-row">
            <SimpleTooltip :content="item.video.title">
              <strong class="video-title">
                {{ item.video.title }}
              </strong>
            </SimpleTooltip>

            <div
              class="flex items-center gap-0.5 shrink-0"
              @click.stop
            >
              <SimpleTooltip content="站内播放预览">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="站内播放预览"
                  @click.stop.prevent="emit('play')"
                >
                  <Play class="size-3.5" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip
                v-if="canPushObs"
                content="同步到 OBS 鉴赏角标"
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="同步到 OBS 鉴赏角标"
                  @click.stop.prevent="emit('pushToObs')"
                >
                  <Radio class="size-3.5 text-primary" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip content="在哔哩哔哩打开">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="在哔哩哔哩打开"
                  @click.stop.prevent="emit('select')"
                >
                  <ExternalLink class="size-3.5" />
                </Button>
              </SimpleTooltip>
            </div>
          </div>

          <!-- UP 主与 BV 号 -->
          <div class="meta-row">
            <SimpleTooltip :content="`UP 主: ${item.video.ownerName}`">
              <span class="owner">
                <User class="size-3.5 shrink-0" />
                <span class="owner-name">{{ item.video.ownerName }}</span>
              </span>
            </SimpleTooltip>
            <code class="bvid-code">{{ item.info.bvid }}</code>
          </div>

          <!-- 粉丝推荐理由 -->
          <div
            v-if="primarySender"
            class="recommend-block"
          >
            <div class="recommend-author">
              <span class="sender-tag">
                <Heart class="size-3.5 shrink-0" />
                <span class="sender-name">{{ primarySender.sender || '匿名粉丝' }}</span>
              </span>

              <Popover v-if="otherSendersCount > 0">
                <PopoverTrigger as-child>
                  <Badge
                    variant="secondary"
                    size="xs"
                    class="cursor-pointer shrink-0 hover:bg-secondary/80"
                    @click.stop
                  >
                    +{{ otherSendersCount }} 人推荐
                  </Badge>
                </PopoverTrigger>
                <PopoverContent
                  class="w-72 p-2.5 space-y-2 text-xs"
                  @click.stop
                >
                  <div class="font-semibold text-foreground">全部推荐人 ({{ item.info.senders.length }})</div>
                  <div class="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin pr-1">
                    <div
                      v-for="(sender, sIdx) in item.info.senders"
                      :key="sIdx"
                      class="p-1.5 rounded bg-muted/40 border border-border/60 space-y-0.5"
                    >
                      <div class="font-medium text-foreground">{{ sender.sender || '匿名粉丝' }}</div>
                      <p
                        v-if="sender.description"
                        class="text-[11px] text-muted-foreground leading-relaxed m-0"
                      >
                        “{{ sender.description }}”
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <SimpleTooltip
              v-if="primarySender.description"
              :content="primarySender.description"
            >
              <p class="recommend-quote">
                <MessageSquare class="quote-icon size-3 inline-block" />
                <span>{{ primarySender.description }}</span>
              </p>
            </SimpleTooltip>
            <span
              v-else
              class="recommend-empty-note"
            >
              推荐了此视频
            </span>
          </div>

          <!-- 若无推荐人但有 B 站原简介 -->
          <SimpleTooltip
            v-else-if="item.video.description"
            :content="item.video.description"
          >
            <p class="video-desc">
              {{ item.video.description }}
            </p>
          </SimpleTooltip>

          <!-- 兜底占位 -->
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
          <Button
            variant="outline"
            size="xs"
            class="flip-back-btn gap-1"
            aria-label="重新盖上"
            @click.stop="emit('toggleReveal')"
          >
            <ArrowLeftRight class="size-3" />
            盖上
          </Button>
        </div>
      </div>

      <!-- 背面内容（翻牌盲盒面） -->
      <div
        role="button"
        tabindex="0"
        class="mystery-face cursor-pointer focus:outline-hidden"
        :aria-label="`点击翻开第 ${index + 1} 个视频`"
        @click.stop="emit('toggleReveal')"
        @keydown.enter.stop="emit('toggleReveal')"
      >
        <div class="mystery-pattern" />
        <span class="mystery-number">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="mystery-center">
          <div class="mystery-icon-circle">
            <HelpCircle class="size-6" />
          </div>
          <strong class="mystery-text">点击揭晓</strong>
          <span class="mystery-hint">TAP TO REVEAL</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.video-result-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  color: var(--foreground);
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
  border-radius: var(--radius);
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
  background: var(--card);
  border: var(--ui-border-width, 1px) var(--ui-border-style, solid) var(--border);
  border-radius: var(--radius);
  box-shadow: var(--ui-shadow);
  backface-visibility: hidden;
  transition:
    transform 0.45s cubic-bezier(0.2, 0.8, 0.25, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.video-result-card__content {
  cursor: pointer;
}

.video-result-card:hover .video-result-card__content {
  border-color: color-mix(in srgb, var(--primary) 60%, var(--border));
  transform: translateY(-2px);
}

.is-featured .video-result-card__content {
  box-shadow: 0 10px 30px -10px color-mix(in srgb, var(--primary) 25%, transparent);
}

.video-result-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  flex: 0 0 auto;
  overflow: hidden;
  background: var(--muted);
}

.video-result-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.video-result-card:hover .video-result-card__media img {
  transform: scale(1.03);
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
  background: rgb(0 0 0 / 62%);
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
  color: rgb(255 255 255 / 90%);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  background: rgb(0 0 0 / 65%);
  backdrop-filter: blur(6px);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.watch-toggle-btn:hover {
  background: rgb(0 0 0 / 85%);
  border-color: rgb(255 255 255 / 45%);
  transform: scale(1.04);
}

.watch-toggle-btn.is-active {
  color: var(--primary-foreground);
  background: var(--primary);
  border-color: var(--primary);
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

.is-featured .video-result-card__details {
  height: 152px;
  min-height: 152px;
  max-height: 152px;
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
  height: 58px;
  min-height: 58px;
  max-height: 58px;
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
  color: var(--primary);
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
  opacity: 0.78;
  flex-shrink: 0;
}

.recommend-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  border-left: 3px solid var(--primary);
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
  color: var(--primary);
  font-weight: 600;
  min-width: 0;
}

.sender-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-quote {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--foreground);
  font-size: 12px;
  line-height: 1.4;
  font-style: italic;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  opacity: 0.92;
}

.recommend-empty-note {
  font-size: 11px;
  color: var(--muted-foreground);
}

.quote-icon {
  margin-right: 4px;
  vertical-align: -1px;
  color: var(--primary);
}

.video-desc {
  display: -webkit-box;
  margin: auto 0 0;
  overflow: hidden;
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
  font-size: 11px;
  background: color-mix(in srgb, var(--border) 22%, transparent);
  border-radius: 4px;
}

.empty-desc-text {
  opacity: 0.72;
}

.is-watched .video-result-card__content {
  opacity: 0.65;
  filter: grayscale(0.2);
}

.is-watched:hover .video-result-card__content {
  opacity: 0.92;
  filter: none;
}

.flip-revealed-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px dashed var(--border);
  background: color-mix(in srgb, var(--muted) 75%, transparent);
}

.flip-order {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
}

.mystery-face {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--primary);
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%),
    var(--card);
  border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
  cursor: pointer;
  text-align: center;
  box-sizing: border-box;
}

.mystery-face:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--primary) 25%, transparent);
}

.mystery-pattern {
  position: absolute;
  inset: 8px;
  border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent);
  border-radius: calc(var(--radius) - 4px);
  pointer-events: none;
}

.mystery-number {
  position: absolute;
  top: 14px;
  left: 16px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-foreground);
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
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.mystery-face:hover .mystery-icon-circle {
  transform: scale(1.08) rotate(6deg);
}

.mystery-text {
  font-size: 15px;
  letter-spacing: 1px;
}

.mystery-hint {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--muted-foreground);
  letter-spacing: 1.5px;
  opacity: 0.7;
}

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
