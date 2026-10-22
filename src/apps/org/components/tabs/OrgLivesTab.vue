<script setup lang="ts">
import {
  ChatbubblesOutline,
  DownloadOutline,
  PeopleOutline,
  SearchOutline,
  TimeOutline,
  WalletOutline,
} from '@vicons/ionicons5'
import { format } from 'date-fns'
import { computed, onMounted } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { injectOrgLives } from '../../composables/useOrgLives'
import { injectOrgStreamers } from '../../composables/useOrgStreamers'
import { exportCsv, withImageSize } from '../../utils'

const { loading, view, streamerFilter, sortKey, search, load } = injectOrgLives()
const { options: streamerOptions } = injectOrgStreamers()

const sortOptions = [
  { label: '按时间', value: 'startAt' },
  { label: '按营收', value: 'income' },
  { label: '按互动', value: 'interaction' },
  { label: '按弹幕', value: 'danmaku' },
]

const streamerSelectOptions = computed(() => [{ label: '全部主播', value: 0 }, ...streamerOptions.value])

function exportLives() {
  exportCsv(
    `直播记录_${Date.now()}.csv`,
    ['主播', '标题', '分区', '开始时间', '营收', '互动', '弹幕', '点赞'],
    view.value.map(({ streamer, live }) => [
      streamer.name,
      live.title,
      `${live.parentArea}/${live.area}`,
      new Date(live.startAt).toLocaleString(),
      live.totalIncomeWithGuard.toFixed(2),
      live.interactionCount,
      live.danmakusCount,
      live.likeCount,
    ]),
  )
}

onMounted(() => load())
</script>

<template>
  <TooltipProvider>
    <div class="space-y-3.5 text-xs">
      <!-- 搜索与筛选工具栏 -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative w-52">
          <Input
            v-model="search"
            placeholder="搜索标题/主播"
            class="pl-7"
          />
          <component
            :is="SearchOutline"
            class="size-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
          />
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
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
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
              class="text-xs"
            >
              {{ s.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          class="gap-1"
          :disabled="view.length === 0"
          @click="exportLives"
        >
          <component
            :is="DownloadOutline"
            class="size-3.5"
          />
          导出 CSV
        </Button>

        <span class="text-[11px] text-muted-foreground ml-auto">共 {{ view.length }} 场</span>
      </div>

      <div
        v-if="loading"
        class="py-12 flex justify-center"
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
          class="border border-border/80 overflow-hidden flex flex-col hover:border-primary/50 transition-colors"
        >
          <!-- 封面大图 -->
          <div class="h-36 overflow-hidden relative bg-muted/40">
            <img
              v-if="item.live.coverUrl"
              :src="withImageSize(item.live.coverUrl, '@140h')"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover"
              alt=""
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center text-muted-foreground"
            >
              <component
                :is="TimeOutline"
                class="size-10"
              />
            </div>

            <!-- 状态标签 -->
            <div class="absolute top-2 right-2">
              <Badge
                v-if="!item.live.isFinish"
                variant="default"
                class="text-[10px] h-4.5 px-1.5 font-semibold bg-emerald-600 hover:bg-emerald-600 text-white shadow-xs"
              >
                LIVE
              </Badge>
              <Badge
                v-else
                variant="secondary"
                class="text-[10px] h-4.5 px-1.5 font-normal bg-black/60 text-white border-none shadow-xs"
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

              <div class="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mt-1.5">
                <span>{{ item.live.parentArea }} / {{ item.live.area }}</span>
                <span>
                  {{ format(item.live.startAt, 'MM-dd HH:mm') }}
                  <template v-if="item.live.stopAt"> - {{ format(item.live.stopAt, 'HH:mm') }} </template>
                  <template v-else> - Now </template>
                </span>
              </div>
            </div>

            <div
              class="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground"
            >
              <span
                class="inline-flex items-center gap-1"
                title="营收"
              >
                <component
                  :is="WalletOutline"
                  class="size-3"
                />
                {{ item.live.totalIncomeWithGuard.toFixed(0) }}
              </span>
              <span
                class="inline-flex items-center gap-1"
                title="互动"
              >
                <component
                  :is="PeopleOutline"
                  class="size-3"
                />
                {{ item.live.interactionCount }}
              </span>
              <span
                class="inline-flex items-center gap-1"
                title="弹幕"
              >
                <component
                  :is="ChatbubblesOutline"
                  class="size-3"
                />
                {{ item.live.danmakusCount }}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </TooltipProvider>
</template>
