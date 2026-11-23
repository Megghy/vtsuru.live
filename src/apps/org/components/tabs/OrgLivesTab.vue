<script setup lang="ts">
import { Clock, Download, MessageSquare, Search, Users, Wallet } from 'lucide-vue-next'
import { format } from 'date-fns'
import { computed, onMounted, watch } from 'vue'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { useOrgContext } from '../../composables/useOrgContext'
import { injectOrgLives } from '../../composables/useOrgLives'
import { injectOrgStreamers } from '../../composables/useOrgStreamers'
import { exportCsv, withImageSize } from '../../utils'

const ctx = useOrgContext()
const { loading, error, view, streamerFilter, sortKey, rangeDays, search, load } = injectOrgLives()
const { options: streamerOptions } = injectOrgStreamers()

const sortOptions = computed(() => {
  const base = [{ label: '按时间', value: 'startAt' }]
  if (ctx.canViewRevenue.value) base.push({ label: '按营收', value: 'income' })
  base.push({ label: '按互动', value: 'interaction' }, { label: '按弹幕', value: 'danmaku' })
  return base
})

const streamerSelectOptions = computed(() => [{ label: '全部主播', value: 0 }, ...streamerOptions.value])

function exportLives() {
  const headers = ctx.canViewRevenue.value
    ? ['主播', '标题', '分区', '开始时间', '营收', '互动', '弹幕', '点赞']
    : ['主播', '标题', '分区', '开始时间', '互动', '弹幕', '点赞']
  exportCsv(
    `直播记录_近${rangeDays.value}天_${Date.now()}.csv`,
    headers,
    view.value.map(({ streamer, live }) =>
      ctx.canViewRevenue.value
        ? [
            streamer.name,
            live.title,
            `${live.parentArea}/${live.area}`,
            new Date(live.startAt).toLocaleString(),
            live.totalIncomeWithGuard.toFixed(2),
            live.interactionCount,
            live.danmakusCount,
            live.likeCount,
          ]
        : [
            streamer.name,
            live.title,
            `${live.parentArea}/${live.area}`,
            new Date(live.startAt).toLocaleString(),
            live.interactionCount,
            live.danmakusCount,
            live.likeCount,
          ],
    ),
  )
}

watch(
  () => ctx.refreshTick.value,
  () => {
    void load(true, rangeDays.value)
  },
)

onMounted(() => load())
</script>

<template>
  <TooltipProvider>
    <div class="space-y-3.5 text-xs">
      <!-- 搜索与筛选工具栏 -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative w-52 max-w-full">
          <Input
            v-model="search"
            placeholder="搜索标题 / 主播"
            class="pl-8"
          />
          <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <Select
          :model-value="String(streamerFilter)"
          @update:model-value="streamerFilter = Number($event)"
        >
          <SelectTrigger class="w-40">
            <SelectValue placeholder="筛选主播" />
          </SelectTrigger>
          <SelectContent class="max-h-56">
            <SelectItem
              v-for="opt in streamerSelectOptions"
              :key="opt.value"
              :value="String(opt.value)"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="String(rangeDays)"
          @update:model-value="load(true, Number($event))"
        >
          <SelectTrigger class="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">近 7 天</SelectItem>
            <SelectItem value="30">近 30 天</SelectItem>
            <SelectItem value="60">近 60 天</SelectItem>
            <SelectItem value="180">近 180 天</SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="sortKey"
          @update:model-value="sortKey = $event as any"
        >
          <SelectTrigger class="w-28">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="s in sortOptions"
              :key="s.value"
              :value="s.value"
            >
              {{ s.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          class="gap-1.5"
          :disabled="view.length === 0"
          @click="exportLives"
        >
          <Download class="size-3.5" />
          导出 CSV
        </Button>

        <span class="text-[11px] text-muted-foreground font-mono tabular-nums ml-auto">共 {{ view.length }} 场</span>
      </div>

      <Alert
        v-if="error"
        variant="destructive"
      >
        <AlertDescription class="flex-between gap-2">
          <span>{{ error }}</span>
          <Button
            variant="outline"
            size="xs"
            @click="load(true, rangeDays)"
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>

      <div
        v-else-if="loading"
        class="py-12 flex-center"
      >
        <Spin />
      </div>
      <div
        v-else-if="view.length === 0"
        class="py-10"
      >
        <Empty description="暂无直播记录" />
      </div>

      <!-- 直播卡片网格 -->
      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <Card
          v-for="item in view"
          :key="item.live.liveId"
          class="overflow-hidden flex flex-col hover:border-primary/50 transition-colors"
        >
          <!-- 封面大图 -->
          <div class="h-36 overflow-hidden relative bg-muted/40">
            <ImagePreview
              v-if="item.live.coverUrl"
              :src="withImageSize(item.live.coverUrl, '@140h')"
              :preview-src="item.live.coverUrl"
              :alt="item.live.title"
              wrapper-class="block size-full"
            >
              <template #default="{ open }">
                <button
                  type="button"
                  class="block size-full cursor-zoom-in p-0 border-0 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :aria-label="`放大查看 ${item.live.title}`"
                  @click="open()"
                >
                  <img
                    :src="withImageSize(item.live.coverUrl, '@140h')"
                    referrerpolicy="no-referrer"
                    class="w-full h-full object-cover"
                    :alt="item.live.title"
                  />
                </button>
              </template>
            </ImagePreview>
            <div
              v-else
              class="w-full h-full flex-center text-muted-foreground"
            >
              <Clock class="size-8 opacity-50" />
            </div>

            <!-- 状态标签 -->
            <div class="pointer-events-none absolute top-2 right-2">
              <Badge
                v-if="!item.live.isFinish"
                variant="default"
                size="xs"
                class="bg-emerald-600 hover:bg-emerald-600 text-white shadow-xs"
              >
                LIVE
              </Badge>
              <Badge
                v-else
                variant="secondary"
                size="xs"
                class="bg-black/60 text-white border-none shadow-xs"
              >
                已结束
              </Badge>
            </div>

            <!-- 主播信息条 -->
            <div
              class="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[11px]"
            >
              <img
                v-if="item.streamer.faceUrl"
                :src="withImageSize(item.streamer.faceUrl, '@20w')"
                referrerpolicy="no-referrer"
                class="size-4 rounded-full object-cover border border-white/60"
                alt=""
              />
              <span class="truncate max-w-[120px]">{{ item.streamer.name }}</span>
            </div>
          </div>

          <CardContent class="p-3 flex-1 flex flex-col justify-between gap-2.5">
            <div>
              <Tooltip>
                <TooltipTrigger as-child>
                  <h4
                    class="font-medium text-xs text-foreground line-clamp-2 leading-snug m-0 hover:text-primary transition-colors cursor-default"
                  >
                    {{ item.live.title }}
                  </h4>
                </TooltipTrigger>
                <TooltipContent>{{ item.live.title }}</TooltipContent>
              </Tooltip>

              <div class="flex-between gap-2 text-[11px] text-muted-foreground mt-1.5">
                <span class="truncate">{{ item.live.parentArea }} / {{ item.live.area }}</span>
                <span class="whitespace-nowrap font-mono tabular-nums">
                  {{ format(item.live.startAt, 'MM-dd HH:mm') }}
                  <template v-if="item.live.stopAt"> - {{ format(item.live.stopAt, 'HH:mm') }}</template>
                  <template v-else-if="!item.live.isFinish"> - 直播中</template>
                </span>
              </div>
            </div>

            <div class="pt-2 border-t border-border/60 flex-between text-[11px] text-muted-foreground font-mono tabular-nums">
              <span
                v-if="ctx.canViewRevenue.value"
                class="inline-flex items-center gap-1"
                title="营收"
              >
                <Wallet class="size-3" />
                ¥{{ item.live.totalIncomeWithGuard.toFixed(0) }}
              </span>
              <span
                class="inline-flex items-center gap-1"
                title="互动"
              >
                <Users class="size-3" />
                {{ item.live.interactionCount }}
              </span>
              <span
                class="inline-flex items-center gap-1"
                title="弹幕"
              >
                <MessageSquare class="size-3" />
                {{ item.live.danmakusCount }}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </TooltipProvider>
</template>
