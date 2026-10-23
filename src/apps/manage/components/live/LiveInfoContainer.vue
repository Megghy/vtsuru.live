<script setup lang="ts">
import {
  Chat24Regular,
  Clock24Regular,
  HandRight24Regular,
  Info24Filled,
  Money24Regular,
  Open24Regular,
  Video24Regular,
} from '@vicons/fluent'
import { format } from 'date-fns'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponseLiveInfoModel } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

interface Props {
  live: ResponseLiveInfoModel
  showActions?: boolean
}

const props = defineProps<Props>()

const router = useRouter()
const coverError = ref(false)

const guartPriceStartData = new Date(Date.UTC(2024, 2, 24, 10, 0, 0))

watch(
  () => props.live,
  () => {
    coverError.value = false
  },
  { immediate: true },
)

const durationText = computed(() => {
  const start = Number(props.live.startAt) || 0
  if (!start) return '-'
  const end = props.live.isFinish ? Number(props.live.stopAt) || start : Date.now()
  const diffMinutes = Math.max(0, Math.floor((end - start) / 60000))
  if (diffMinutes < 1) return '不足 1 分钟'
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
  }
  return `${mins}分钟`
})

const effectiveIncome = computed(() => {
  const rawIncome =
    new Date(props.live.startAt) < guartPriceStartData ? props.live.totalIncomeWithGuard : props.live.totalIncome
  return Number(rawIncome || 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
})

function onClickRow() {
  router.push({
    name: 'manage-liveDetail',
    params: { id: props.live.liveId },
  })
}
</script>

<template>
  <div
    class="flex items-center gap-3.5 p-3 rounded-lg border border-border bg-card/60 hover:bg-muted/40 cursor-pointer transition-colors"
    @click="onClickRow"
  >
    <!-- 封面 -->
    <div
      class="relative w-28 h-16 sm:w-36 sm:h-20 rounded-md overflow-hidden bg-muted/60 shrink-0 border border-border"
    >
      <img
        v-if="live.coverUrl && !coverError"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover"
        :src="`${live.coverUrl}@240w_135h_1c.webp`"
        loading="lazy"
        alt="直播封面"
        @error="coverError = true"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-muted-foreground/60"
      >
        <component
          :is="Video24Regular"
          class="h-7 w-7"
        />
      </div>

      <div
        v-if="!live.isFinish"
        class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive text-destructive-foreground flex items-center gap-1 shadow-sm"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
        LIVE
      </div>
    </div>

    <!-- 中间主体信息 -->
    <div class="flex-1 min-w-0 space-y-1.5">
      <div class="flex items-center gap-2">
        <h4
          class="text-sm font-semibold truncate text-foreground hover:text-brand transition-colors"
          :title="live.title || '无标题直播'"
        >
          {{ live.title || '无标题直播' }}
        </h4>
      </div>

      <div class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <Badge
          :variant="!live.isFinish ? 'destructive' : 'secondary'"
          class="text-[10px] px-1.5 py-0 h-4"
        >
          {{ !live.isFinish ? '直播中' : '已结束' }}
        </Badge>

        <span
          v-if="live.parentArea || live.area"
          class="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] border border-border"
        >
          {{ live.parentArea ? `${live.parentArea} / ` : '' }}{{ live.area }}
        </span>

        <Popover>
          <PopoverTrigger as-child>
            <span
              class="flex items-center gap-1 text-[11px] hover:text-foreground cursor-pointer"
              @click.stop
            >
              <component
                :is="Clock24Regular"
                class="h-3 w-3"
              />
              {{ format(live.startAt, 'yyyy-MM-dd HH:mm') }}
            </span>
          </PopoverTrigger>
          <PopoverContent class="w-56 p-2 text-xs space-y-1">
            <div>开播: {{ format(live.startAt, 'yyyy-MM-dd HH:mm:ss') }}</div>
            <div v-if="live.isFinish">停播: {{ live.stopAt ? format(live.stopAt, 'yyyy-MM-dd HH:mm:ss') : '-' }}</div>
            <div>历时: {{ durationText }}</div>
          </PopoverContent>
        </Popover>

        <span class="text-[11px]"> {{ live.isFinish ? '时长 ' : '已播 ' }}{{ durationText }} </span>
      </div>
    </div>

    <!-- 右侧数据指标统计 -->
    <div class="flex items-center gap-3 sm:gap-6 text-right shrink-0">
      <div class="hidden sm:block">
        <div class="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
          <component
            :is="Chat24Regular"
            class="h-3 w-3"
          />
          弹幕
        </div>
        <div class="font-mono text-sm font-bold text-foreground mt-0.5">
          {{ (live.danmakusCount || 0).toLocaleString() }}
        </div>
      </div>

      <div class="hidden sm:block">
        <div class="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
          <component
            :is="HandRight24Regular"
            class="h-3 w-3"
          />
          互动
        </div>
        <div class="font-mono text-sm font-bold text-foreground mt-0.5">
          {{ (live.interactionCount || 0).toLocaleString() }}
        </div>
      </div>

      <div>
        <div class="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
          <component
            :is="Money24Regular"
            class="h-3 w-3 text-amber-500"
          />
          收益
        </div>
        <div class="font-mono text-sm font-bold text-amber-500 mt-0.5">
          <span class="text-xs">¥</span>{{ effectiveIncome }}
        </div>
      </div>

      <div
        v-if="showActions !== false"
        class="text-muted-foreground hover:text-foreground pl-1"
      >
        <component
          :is="Open24Regular"
          class="h-4 w-4"
        />
      </div>
    </div>
  </div>
</template>
