<script setup lang="ts">
import {
  CalendarCheckmark24Regular,
  Chat24Regular,
  Gift24Regular,
  Person24Regular,
  Star24Regular,
} from '@vicons/fluent'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import type { ResponsePointHisrotyModel } from '@/api/client-types'
import { EventDataTypes, PointFrom } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Separator } from '@/shared/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { formatDanmakuPrice, getDanmakuGiftDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'

import PointGoodsItem from './PointGoodsItem.vue'

const props = defineProps<{
  histories: ResponsePointHisrotyModel[]
}>()

const page = ref(1)
const pageSize = 10
const showGoodsModal = ref(false)
const currentHistory = ref<ResponsePointHisrotyModel>()
const currentGoods = computed(() => currentHistory.value?.extra?.goods)
const selectedSubItems = computed(() => currentHistory.value?.extra?.selectedSubItems ?? [])
const pagedHistories = computed(() => props.histories.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(
  () => props.histories,
  () => (page.value = 1),
)

function sourceMeta(row: ResponsePointHisrotyModel): {
  label: string
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon: Component
} {
  switch (row.from) {
    case PointFrom.Danmaku:
      return { label: '直播互动', badgeVariant: 'secondary', icon: Chat24Regular }
    case PointFrom.Manual:
      return {
        label: row.point >= 0 ? '主播赠予' : '主播扣除',
        badgeVariant: row.point >= 0 ? 'default' : 'destructive',
        icon: Person24Regular,
      }
    case PointFrom.Use:
      return { label: '礼物兑换', badgeVariant: 'secondary', icon: Gift24Regular }
    case PointFrom.CheckIn:
      return { label: '签到', badgeVariant: 'default', icon: CalendarCheckmark24Regular }
    case PointFrom.DailyFirstInteraction:
      return { label: '首次互动', badgeVariant: 'secondary', icon: Star24Regular }
  }
}

function giftDetail(row: ResponsePointHisrotyModel) {
  const danmaku = row.extra?.danmaku
  if (!danmaku) return '礼物详情缺失'
  const gift = getDanmakuGiftDisplayMeta({ ...danmaku, num: row.count ?? danmaku.num })
  return [
    gift.giftSummaryText,
    gift.mysteryBoxPriceText ? `盲盒 ￥${gift.mysteryBoxPriceText}` : '',
    gift.giftPriceText ? `价值 ￥${gift.giftPriceText}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function detailText(row: ResponsePointHisrotyModel) {
  switch (row.from) {
    case PointFrom.Danmaku:
      if (row.type === EventDataTypes.Guard) return `上舰 · ${row.extra?.danmaku?.msg || '舰长支持'}`
      if (row.type === EventDataTypes.Gift) return giftDetail(row)
      if (row.type === EventDataTypes.SC) {
        return `SC ￥${formatDanmakuPrice(row.extra?.danmaku?.price) ?? row.extra?.danmaku?.price ?? 0}`
      }
      return row.extra?.danmaku?.msg || '直播互动'
    case PointFrom.Manual:
      return row.extra?.reason || '未填写调整备注'
    case PointFrom.Use: {
      const variants = row.extra?.selectedSubItems?.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ')
      return [row.extra?.goods?.name || '已删除的礼物', variants, row.extra?.remark].filter(Boolean).join(' · ')
    }
    case PointFrom.CheckIn:
      return '每日签到奖励'
    case PointFrom.DailyFirstInteraction:
      return row.extra?.interactionType === 'gift' ? giftDetail(row) : row.extra?.danmaku?.msg || '每日首次互动奖励'
  }
}

function openGoods(row: ResponsePointHisrotyModel) {
  currentHistory.value = row
  showGoodsModal.value = true
}

function formatRelativeTime(time: number) {
  try {
    return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
  } catch {
    return String(time)
  }
}

function formatFullTime(time: number) {
  try {
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return String(time)
  }
}
</script>

<template>
  <TooltipProvider>
    <div
      v-if="histories.length === 0"
      class="history-empty-state rounded-lg border border-dashed border-border p-12 text-center"
    >
      <Empty
        description="暂无积分明细记录"
        class="py-6"
      >
        <template #extra>
          <span class="empty-tip text-xs text-muted-foreground block mt-2">
            在已开通积分的主播直播间互动、签到或进行礼物兑换后，每笔流水变动都会详细记录在此。
          </span>
        </template>
      </Empty>
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <!-- 桌面端表格 -->
      <div class="hidden md:block rounded-lg border border-border/80 overflow-hidden bg-card text-xs">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent border-b border-border/80">
              <TableHead class="w-32 py-2.5">时间</TableHead>
              <TableHead class="w-28 py-2.5">积分变动</TableHead>
              <TableHead class="w-48 py-2.5">来源</TableHead>
              <TableHead class="py-2.5">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in pagedHistories"
              :key="`${row.ouId}-${row.createAt}-${row.from}`"
              class="hover:bg-muted/30"
            >
              <TableCell class="py-2.5 text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="cursor-help hover:text-foreground">
                      {{ formatRelativeTime(row.createAt) }}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    {{ formatFullTime(row.createAt) }}
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              <TableCell class="py-2.5 whitespace-nowrap font-mono font-bold">
                <span :class="row.point < 0 ? 'text-destructive' : 'text-emerald-600'">
                  {{ row.point > 0 ? '+' : '' }}{{ Number(row.point.toFixed(1)) }}
                </span>
              </TableCell>

              <TableCell class="py-2.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    :variant="sourceMeta(row).badgeVariant"
                    class="text-[10px] h-4.5 px-1.5 font-normal flex items-center gap-1"
                  >
                    <component
                      :is="sourceMeta(row).icon"
                      class="size-3"
                    />
                    <span>{{ sourceMeta(row).label }}</span>
                  </Badge>
                  <a
                    v-if="row.extra?.user?.name"
                    :href="`/@${row.extra.user.name}`"
                    target="_blank"
                    class="text-primary hover:underline text-xs"
                  >
                    {{ row.extra.user.name }}
                  </a>
                </div>
              </TableCell>

              <TableCell class="py-2.5">
                <div
                  v-if="row.from === PointFrom.Use && row.extra?.goods"
                  class="space-y-0.5"
                >
                  <button
                    type="button"
                    class="text-primary hover:underline font-medium cursor-pointer text-left block"
                    @click="openGoods(row)"
                  >
                    {{ row.extra.goods.name }}
                  </button>
                  <span
                    v-if="detailText(row) !== row.extra.goods.name"
                    class="text-[11px] text-muted-foreground block"
                  >
                    {{ detailText(row) }}
                  </span>
                </div>
                <span
                  v-else
                  class="text-muted-foreground break-words"
                >
                  {{ detailText(row) }}
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- 移动端卡片列表 -->
      <div class="md:hidden space-y-2.5">
        <article
          v-for="item in pagedHistories"
          :key="`${item.ouId}-${item.createAt}-${item.from}`"
          class="p-3 rounded-lg border border-border/80 bg-card space-y-2 text-xs"
        >
          <div class="flex items-center justify-between">
            <Badge
              :variant="sourceMeta(item).badgeVariant"
              class="text-[10px] h-4.5 px-1.5 font-normal flex items-center gap-1"
            >
              <component
                :is="sourceMeta(item).icon"
                class="size-3"
              />
              <span>{{ sourceMeta(item).label }}</span>
            </Badge>
            <strong
              class="font-mono"
              :class="item.point < 0 ? 'text-destructive' : 'text-emerald-600'"
            >
              {{ item.point > 0 ? '+' : '' }}{{ Number(item.point.toFixed(1)) }}
            </strong>
          </div>

          <p class="text-xs text-foreground m-0 break-words">{{ detailText(item) }}</p>

          <div
            class="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40"
          >
            <a
              v-if="item.extra?.user?.name"
              :href="`/@${item.extra.user.name}`"
              target="_blank"
              class="text-primary hover:underline"
            >
              {{ item.extra.user.name }}
            </a>
            <span v-else />
            <span>{{ formatRelativeTime(item.createAt) }}</span>
          </div>

          <Button
            v-if="item.from === PointFrom.Use && item.extra?.goods"
            variant="outline"
            class="w-full mt-1"
            @click="openGoods(item)"
          >
            查看礼物快照
          </Button>
        </article>
      </div>

      <!-- 分页栏 -->
      <div
        v-if="histories.length > pageSize"
        class="flex justify-center pt-2"
      >
        <Pagination
          :total="histories.length"
          :items-per-page="pageSize"
          :page="page"
          @update:page="page = $event"
        />
      </div>
    </div>

    <!-- 礼物快照弹窗 -->
    <Dialog
      v-if="currentHistory"
      v-model:open="showGoodsModal"
    >
      <DialogContent class="sm:max-w-md p-4">
        <DialogHeader class="pb-2 border-b border-border/60">
          <DialogTitle class="text-sm font-semibold">礼物快照</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 pt-2 text-xs">
          <PointGoodsItem
            v-if="currentGoods"
            :goods="currentGoods"
          />

          <template v-if="selectedSubItems.length">
            <Separator />
            <div class="space-y-1.5">
              <span class="text-[11px] font-medium text-muted-foreground block">已选款式</span>
              <div class="space-y-1">
                <div
                  v-for="item in selectedSubItems"
                  :key="item.subItemId"
                  class="flex items-center justify-between p-1.5 rounded bg-muted/40 text-xs"
                >
                  <strong class="font-medium text-foreground">{{ item.nameSnapshot }}</strong>
                  <div class="flex items-center gap-2">
                    <span class="text-muted-foreground">x {{ item.quantity }}</span>
                    <Badge
                      variant="secondary"
                      class="text-[10px] h-4.5 px-1 font-normal font-mono"
                    >
                      {{ item.priceSnapshot }} 积分
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-if="currentGoods?.content">
            <Separator />
            <div class="space-y-1">
              <span class="text-[11px] font-medium text-muted-foreground block">礼物内容</span>
              <Textarea
                :model-value="currentGoods.content"
                readonly
                rows="3"
                class="text-xs resize-none bg-muted/20"
              />
            </div>
          </template>

          <template v-if="currentHistory.extra?.remark">
            <Separator />
            <div class="space-y-1">
              <span class="text-[11px] font-medium text-muted-foreground block">兑换留言</span>
              <p class="text-xs text-foreground bg-muted/30 p-2 rounded m-0">{{ currentHistory.extra.remark }}</p>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
