<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { format } from 'date-fns'
import { computed } from 'vue'

import type { VideoCollectTable } from '@/api/api-models'
import router from '@/app/router'
import { CURRENT_HOST } from '@/shared/config'

const props = defineProps<{
  item: VideoCollectTable
  canClick?: boolean
  from: 'user' | 'owner'
  bordered?: boolean
}>()

const now = useNow({ interval: 1000 })
const remainingTime = computed(() => Math.max(0, props.item.endAt - now.value.getTime()))
const remainingTimeLabel = computed(() => {
  const seconds = Math.ceil(remainingTime.value / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${String(hours).padStart(2, '0')}时 ${String(minutes).padStart(2, '0')}分 ${String(remainingSeconds).padStart(2, '0')}秒`
})

function formatTime(timestamp: number) {
  return format(timestamp, 'yyyy-MM-dd HH:mm')
}

function openCollection() {
  if (!props.canClick) return

  if (props.from === 'user') {
    window.open(`${CURRENT_HOST}video-collect/${props.item.shortId}`, '_blank')
    return
  }

  router.push({ name: 'manage-videoCollect-Detail', params: { id: props.item.id } })
}
</script>

<template>
  <UCard
    class="video-collect-info-card"
    :class="{ 'video-collect-info-card--clickable': canClick }"
    :variant="bordered ? 'outline' : 'soft'"
    :tabindex="canClick ? 0 : undefined"
    :role="canClick ? 'link' : undefined"
    :aria-label="canClick ? `打开视频征集：${item.name}` : undefined"
    @click="openCollection"
    @keydown.enter.prevent="openCollection"
    @keydown.space.prevent="openCollection"
  >
    <template #header>
      <div class="video-collect-info-card__header">
        <div class="video-collect-info-card__title">
          <UBadge
            :color="item.isFinish ? 'neutral' : 'success'"
            variant="subtle"
            size="xs"
            :label="item.isFinish ? '已结束' : '进行中'"
          />
          <strong>{{ item.name }}</strong>
        </div>
        <slot name="header-extra" />
      </div>
    </template>

    <div class="video-collect-info-card__details">
      <time>创建于 {{ formatTime(item.createAt) }}</time>
      <time>结束于 {{ formatTime(item.endAt) }}</time>
      <UTooltip :text="item.description">
        <p>{{ item.description }}</p>
      </UTooltip>
    </div>

    <template #footer>
      <div class="video-collect-info-card__footer">
        <UTooltip text="已征集数量 / 最大征集数量">
          <span>
            <UIcon name="i-lucide-list-ordered" />
            {{ item.videoCount }} / {{ item.maxVideoCount }}
          </span>
        </UTooltip>
        <UTooltip
          v-if="!item.isFinish"
          :text="`结束于 ${formatTime(item.endAt)}`"
        >
          <span>
            <UIcon name="i-lucide-clock-3" />
            剩余 {{ remainingTimeLabel }}
          </span>
        </UTooltip>
      </div>
    </template>
  </UCard>
</template>

<style scoped>
.video-collect-info-card--clickable {
  width: 100%;
  cursor: pointer;
}

.video-collect-info-card--clickable:focus-visible {
  outline: 2px solid var(--vtsuru-brand);
  outline-offset: 3px;
}

.video-collect-info-card__header,
.video-collect-info-card__title,
.video-collect-info-card__footer,
.video-collect-info-card__footer span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.video-collect-info-card__header {
  justify-content: space-between;
}

.video-collect-info-card__details {
  display: grid;
  gap: 6px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.video-collect-info-card__details p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.video-collect-info-card__footer {
  flex-wrap: wrap;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
</style>
