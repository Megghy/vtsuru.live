<script setup lang="ts">
import { Clock24Regular, NumberRow24Regular } from '@vicons/fluent'
import { useNow } from '@vueuse/core'
import { format } from 'date-fns'
import { computed } from 'vue'

import type { VideoCollectTable } from '@/api/api-models'
import router from '@/app/router'
import { CURRENT_HOST } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  item: VideoCollectTable
  canClick?: boolean
  from: 'user' | 'owner'
  bordered?: boolean
}>()

const now = useNow({ interval: 1000 })
const isUpcoming = computed(() => !props.item.isFinish && props.item.startAt > now.value.getTime())

const countdownText = computed(() => {
  const target = isUpcoming.value ? props.item.startAt : props.item.endAt
  const diff = Math.max(0, target - now.value.getTime())
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}时 ${String(minutes).padStart(2, '0')}分 ${String(seconds).padStart(2, '0')}秒`
})

function onClick() {
  if (props.canClick === true) {
    if (props.from === 'user') {
      window.open(`${CURRENT_HOST}video-collect/${props.item.shortId}`, '_blank')
    } else {
      router.push({ name: 'manage-videoCollect-Detail', params: { id: props.item.id } })
    }
  }
}
</script>

<template>
  <TooltipProvider>
    <Card
      class="transition text-xs"
      :class="{
        'is-clickable hover:shadow-md cursor-pointer': canClick,
        'border-border/80': bordered !== false,
      }"
      :tabindex="canClick ? 0 : undefined"
      :role="canClick ? 'link' : undefined"
      :aria-label="canClick ? `打开视频征集：${item.name}` : undefined"
      @click="onClick"
      @keydown.enter.prevent="onClick"
      @keydown.space.prevent="onClick"
    >
      <CardHeader class="p-3 pb-2 border-b border-border/60 flex flex-row items-center justify-between space-y-0 gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <Badge
            v-if="item.isFinish"
            variant="secondary"
            class="text-[10px] h-4.5 px-1.5 font-normal"
          >
            已结束
          </Badge>
          <Badge
            v-else-if="isUpcoming"
            variant="default"
            class="text-[10px] h-4.5 px-1.5 font-normal bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
          >
            未开始
          </Badge>
          <Badge
            v-else
            variant="default"
            class="text-[10px] h-4.5 px-1.5 font-normal bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          >
            进行中
          </Badge>

          <span class="font-semibold text-sm text-foreground truncate">{{ item.name }}</span>
        </div>
        <slot name="header-extra" />
      </CardHeader>

      <CardContent class="p-3 space-y-1.5 text-xs text-muted-foreground">
        <div>创建时间: {{ format(item.createAt, 'yyyy-MM-dd HH:mm') }}</div>
        <div v-if="isUpcoming">开放时间: {{ format(item.startAt, 'yyyy-MM-dd HH:mm') }}</div>
        <div>结束时间: {{ format(item.endAt, 'yyyy-MM-dd HH:mm') }}</div>
        <p
          v-if="item.description"
          class="m-0 pt-1 text-foreground/80 line-clamp-2 leading-relaxed"
          :title="item.description"
        >
          {{ item.description }}
        </p>
      </CardContent>

      <CardFooter
        class="p-3 pt-0 flex items-center gap-3 text-xs text-muted-foreground border-t border-border/40 mt-1 pt-2"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 font-mono cursor-default">
              <component
                :is="NumberRow24Regular"
                class="size-3.5"
              />
              <span>{{ item.videoCount }} / {{ item.maxVideoCount }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>已占用名额 / 最大视频数（待审核 + 已通过）</TooltipContent>
        </Tooltip>

        <template v-if="!item.isFinish">
          <span class="text-border">|</span>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1 font-mono cursor-default">
                <component
                  :is="Clock24Regular"
                  class="size-3.5"
                />
                <span>{{ isUpcoming ? '开放倒计时' : '剩余' }} {{ countdownText }}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {{ isUpcoming ? '开放于' : '结束于' }}
              {{ format(isUpcoming ? item.startAt : item.endAt, 'yyyy-MM-dd HH:mm') }}
            </TooltipContent>
          </Tooltip>
        </template>
      </CardFooter>
    </Card>
  </TooltipProvider>
</template>

<style scoped>
.is-clickable:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary-focus, var(--brand));
  outline-offset: 3px;
}
</style>
